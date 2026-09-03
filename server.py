"""Backend DDU Control berbasis Python standard library dan SQLite."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from http.cookies import SimpleCookie
from urllib.parse import urlparse, parse_qs
from pathlib import Path
from datetime import datetime, timedelta, timezone
import hashlib, hmac, json, os, re, secrets, sqlite3, time

ROOT = Path(__file__).resolve().parent
DB = ROOT / "ddu_control.db"
HOST = os.getenv("DDU_HOST", "127.0.0.1")
PORT = int(os.getenv("DDU_PORT", "8000"))
MAX_BODY = 5_000_000
SESSION_HOURS = 8
LOGIN_WINDOW, LOGIN_LIMIT = 15 * 60, 5
login_attempts = {}

USERS = [
    ("Eva Margareta", "ketuaddu@gmail.com", "ketua", "Ketua"),
    ("Sabili Ridho", "sekretarisddu@gmail.com", "sekretaris", "Sekretaris"),
    ("Epiyani", "ddubendahara@gmail.com", "divisi", "Bendahara"),
    ("Romipan", "administrasiddu@gmail.com", "divisi", "Administrasi"),
    ("Inen Karyadi", "divisi1@gmail.com", "divisi", "Divisi 1"),
    ("Romipan 2", "divisi2@gmail.com", "divisi", "Divisi 2"),
    ("Ejang AR", "divisi3@gmail.com", "divisi", "Divisi 3"),
]

SEED_EMAILS = tuple(user[1] for user in USERS)

def db():
    conn = sqlite3.connect(DB, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return salt.hex() + ":" + key.hex()

def verify_password(password, stored):
    try:
        salt_hex, expected = stored.split(":", 1)
        actual = hash_password(password, bytes.fromhex(salt_hex)).split(":", 1)[1]
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False

def init_db():
    initial_password = os.getenv("DDU_INITIAL_PASSWORD") or secrets.token_urlsafe(12)
    created_users = 0
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS users(
          id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('ketua','sekretaris','divisi')),
          division TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(
          token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          csrf_token TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS realizations(
          id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), division TEXT NOT NULL,
          program TEXT NOT NULL, realization_date TEXT NOT NULL, value REAL NOT NULL CHECK(value >= 0),
          note TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS evaluations(
          id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), division TEXT NOT NULL,
          finding TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS targets(
          id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), division TEXT NOT NULL,
          program TEXT NOT NULL, target_type TEXT NOT NULL CHECK(target_type IN ('uang','jumlah','aktivitas')),
          period TEXT NOT NULL CHECK(period IN ('mingguan','bulanan','tahunan')), target_value REAL NOT NULL CHECK(target_value >= 0),
          unit TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS weekly_reports(
          id INTEGER PRIMARY KEY, target_id INTEGER NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id), week_start TEXT NOT NULL, actual_value REAL NOT NULL CHECK(actual_value >= 0),
          note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, UNIQUE(target_id, week_start));
        CREATE TABLE IF NOT EXISTS donors(
          id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), division TEXT NOT NULL,
          name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', donor_type TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('aktif','nonaktif')), joined_at TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS transactions(
          id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), division TEXT NOT NULL,
          transaction_date TEXT NOT NULL, transaction_type TEXT NOT NULL CHECK(transaction_type IN ('pemasukan','pengeluaran')),
          category TEXT NOT NULL, amount REAL NOT NULL CHECK(amount >= 0), description TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_realizations_division ON realizations(division);
        CREATE INDEX IF NOT EXISTS idx_targets_division ON targets(division);
        CREATE INDEX IF NOT EXISTS idx_weekly_reports_week ON weekly_reports(week_start);
        CREATE INDEX IF NOT EXISTS idx_donors_division ON donors(division);
        CREATE INDEX IF NOT EXISTS idx_transactions_division ON transactions(division);
        CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
        """)
        migrations = {
            "realizations": {"partner_name":"TEXT NOT NULL DEFAULT ''", "distribution_route":"TEXT NOT NULL DEFAULT ''"},
            "donors": {"placement_type":"TEXT NOT NULL DEFAULT ''", "distribution_route":"TEXT NOT NULL DEFAULT ''", "maps_url":"TEXT NOT NULL DEFAULT ''", "photo_data":"TEXT NOT NULL DEFAULT ''"},
            "transactions": {"source_name":"TEXT NOT NULL DEFAULT ''", "source_class":"TEXT NOT NULL DEFAULT ''", "source_origin":"TEXT NOT NULL DEFAULT ''", "distribution_route":"TEXT NOT NULL DEFAULT ''"},
        }
        for table, columns in migrations.items():
            existing_columns = {row["name"] for row in c.execute(f"PRAGMA table_info({table})")}
            for column, definition in columns.items():
                if column not in existing_columns: c.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
        now = datetime.now(timezone.utc).isoformat()
        for name, email, role, division in USERS:
            existing = c.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
            if existing:
                c.execute("UPDATE users SET name=?,role=?,division=?,active=1 WHERE id=?",
                          (name, role, division, existing["id"]))
            else:
                c.execute("INSERT INTO users(name,email,password_hash,role,division,created_at) VALUES(?,?,?,?,?,?)",
                          (name, email, hash_password(initial_password), role, division, now))
                created_users += 1
        # Akun dummy versi awal tidak lagi boleh dipakai setelah akun resmi tersedia.
        placeholders = ",".join("?" for _ in SEED_EMAILS)
        c.execute(f"UPDATE users SET active=0 WHERE email LIKE '%@ddu.test' AND email NOT IN ({placeholders})", SEED_EMAILS)
        div1 = c.execute("SELECT id FROM users WHERE email='divisi1@gmail.com'").fetchone()
        initial_targets = [
            ("Monitoring kotak", "aktivitas", "mingguan", 1, "kegiatan", "Monitoring lokasi kotak dan tabung infak"),
            ("Distribusi Kotak", "jumlah", "mingguan", 5, "kotak", "Penitipan kotak amal pada titik baru"),
            ("Distribusi Tabung Mitra Eksternal", "jumlah", "bulanan", 25, "tabung", "Distribusi tabung kepada mitra eksternal"),
            ("Penghimpunan Kotak", "uang", "mingguan", 2500000, "rupiah", "Target empat kali penghimpunan per bulan"),
            ("Penghimpunan Tabung", "uang", "bulanan", 20000000, "rupiah", "Estimasi 250 tabung per bulan"),
            ("Evaluasi titik / JD sepi", "aktivitas", "bulanan", 1, "evaluasi", "Evaluasi jalur distribusi yang tidak aktif"),
            ("Mencatat pemasukan dan pengeluaran", "aktivitas", "mingguan", 1, "laporan", "Rekap keuangan mingguan"),
            ("Konten distribusi / penarikan kotak amal", "jumlah", "mingguan", 2, "konten", "Target 1–2 konten per minggu"),
        ]
        if div1:
            for program, target_type, period, value, unit, note in initial_targets:
                exists = c.execute("SELECT id FROM targets WHERE division='Divisi 1' AND program=?", (program,)).fetchone()
                if not exists:
                    c.execute("INSERT INTO targets(user_id,division,program,target_type,period,target_value,unit,note,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
                              (div1["id"], "Divisi 1", program, target_type, period, value, unit, note, now))
    return initial_password if created_users else None

def clean_sessions():
    with db() as c: c.execute("DELETE FROM sessions WHERE expires_at < ?", (datetime.now(timezone.utc).isoformat(),))

class App(SimpleHTTPRequestHandler):
    server_version = "DDUControl/1.0"
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, fmt, *args): print(f"[{datetime.now():%H:%M:%S}] {self.address_string()} {fmt % args}")
    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'")
        self.send_header("Cache-Control", "no-store" if self.path.startswith("/api/") else "no-cache")
        super().end_headers()
    def json(self, status, payload, cookie=None):
        raw = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status); self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        if cookie: self.send_header("Set-Cookie", cookie)
        self.end_headers(); self.wfile.write(raw)
    def body(self):
        try: length = int(self.headers.get("Content-Length", "0"))
        except ValueError: raise ValueError("Ukuran permintaan tidak valid")
        if length <= 0 or length > MAX_BODY: raise ValueError("Ukuran permintaan tidak valid")
        try: return json.loads(self.rfile.read(length))
        except json.JSONDecodeError: raise ValueError("JSON tidak valid")
    def session(self):
        cookie = SimpleCookie(self.headers.get("Cookie", "")); morsel = cookie.get("ddu_session")
        if not morsel: return None
        token_hash = hashlib.sha256(morsel.value.encode()).hexdigest()
        with db() as c:
            row = c.execute("SELECT u.id,u.name,u.email,u.role,u.division,s.csrf_token,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND u.active=1", (token_hash,)).fetchone()
        if not row or row["expires_at"] < datetime.now(timezone.utc).isoformat(): return None
        return dict(row)
    def require(self, csrf=False, roles=None):
        user = self.session()
        if not user: self.json(401, {"error":"Sesi berakhir. Silakan masuk kembali."}); return None
        if roles and user["role"] not in roles: self.json(403, {"error":"Anda tidak memiliki izin untuk aksi ini."}); return None
        if csrf and not hmac.compare_digest(self.headers.get("X-CSRF-Token", ""), user["csrf_token"]):
            self.json(403, {"error":"Token keamanan tidak valid."}); return None
        return user
    def may_manage_all(self, user):
        return user["role"] in ("ketua", "sekretaris") or user["division"] == "Administrasi"
    def scoped_division(self, user, requested=""):
        requested = str(requested or "").strip()
        return requested if self.may_manage_all(user) and requested else user["division"]
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/me":
            u = self.session()
            return self.json(200, {"user": {k:u[k] for k in ("id","name","email","role","division")}, "csrf":u["csrf_token"]} if u else {"user":None})
        if path == "/api/realizations":
            u = self.require()
            if not u: return
            sql = "SELECT r.id,r.division,r.program,r.realization_date,r.value,r.note,r.partner_name,r.distribution_route,r.created_at,u.name creator FROM realizations r JOIN users u ON u.id=r.user_id"
            args = ()
            if u["role"] == "divisi" and u["division"] != "Administrasi":
                sql += " WHERE r.division=?"; args = (u["division"],)
            sql += " ORDER BY r.id DESC LIMIT 100"
            with db() as c: rows = [dict(x) for x in c.execute(sql,args)]
            return self.json(200, {"items":rows})
        if path == "/api/targets": return self.get_targets()
        if path == "/api/donors": return self.get_donors()
        if path == "/api/transactions": return self.get_transactions()
        if path.startswith("/api/"): return self.json(404, {"error":"Endpoint tidak ditemukan."})
        if path == "/": self.path = "/index.html"
        return super().do_GET()
    def do_POST(self):
        path = urlparse(self.path).path
        try: data = self.body()
        except ValueError as e: return self.json(400, {"error":str(e)})
        if path == "/api/login": return self.login(data)
        if path == "/api/logout":
            u = self.require(csrf=True)
            if not u: return
            cookie = SimpleCookie(self.headers.get("Cookie", "")); token = cookie.get("ddu_session")
            if token:
                with db() as c: c.execute("DELETE FROM sessions WHERE token_hash=?",(hashlib.sha256(token.value.encode()).hexdigest(),))
            return self.json(200,{"ok":True},"ddu_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0")
        if path == "/api/realizations": return self.add_realization(data)
        if path == "/api/evaluations": return self.add_evaluation(data)
        if path == "/api/targets": return self.add_target(data)
        if path == "/api/weekly-reports": return self.add_weekly_report(data)
        if path == "/api/donors": return self.add_donor(data)
        if path == "/api/transactions": return self.add_transaction(data)
        return self.json(404, {"error":"Endpoint tidak ditemukan."})
    def do_PUT(self):
        path = urlparse(self.path).path
        try: data = self.body()
        except ValueError as e: return self.json(400, {"error":str(e)})
        if path == "/api/targets": return self.update_target(data)
        return self.json(404, {"error":"Endpoint tidak ditemukan."})
    def login(self, data):
        ip = self.client_address[0]; now = time.time(); recent = [t for t in login_attempts.get(ip,[]) if now-t < LOGIN_WINDOW]
        if len(recent) >= LOGIN_LIMIT: return self.json(429,{"error":"Terlalu banyak percobaan. Coba kembali dalam 15 menit."})
        email = str(data.get("email","")).strip().lower(); password = str(data.get("password",""))
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+",email): return self.json(400,{"error":"Format email tidak valid."})
        with db() as c: user = c.execute("SELECT * FROM users WHERE email=? AND active=1",(email,)).fetchone()
        if not user or not verify_password(password,user["password_hash"]):
            recent.append(now); login_attempts[ip]=recent; time.sleep(.25)
            return self.json(401,{"error":"Email atau kata sandi salah."})
        login_attempts.pop(ip,None); token=secrets.token_urlsafe(32); csrf=secrets.token_urlsafe(24)
        expires=(datetime.now(timezone.utc)+timedelta(hours=SESSION_HOURS)).isoformat()
        with db() as c:
            c.execute("DELETE FROM sessions WHERE user_id=?",(user["id"],))
            c.execute("INSERT INTO sessions VALUES(?,?,?,?,?)",(hashlib.sha256(token.encode()).hexdigest(),user["id"],csrf,expires,datetime.now(timezone.utc).isoformat()))
        secure = "; Secure" if os.getenv("DDU_HTTPS") == "1" else ""
        cookie=f"ddu_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={SESSION_HOURS*3600}{secure}"
        return self.json(200,{"user":{"id":user["id"],"name":user["name"],"email":user["email"],"role":user["role"],"division":user["division"]},"csrf":csrf},cookie)
    def add_realization(self,data):
        u=self.require(csrf=True)
        if not u:return
        may_choose_division = u["role"] in ("ketua", "sekretaris") or u["division"] == "Administrasi"
        division=str(data.get("division","")).strip() if may_choose_division else u["division"]
        program=str(data.get("program","")).strip()[:120]; note=str(data.get("note","")).strip()[:2000]; date=str(data.get("date",""))
        try: value=float(data.get("value")); datetime.strptime(date,"%Y-%m-%d")
        except (ValueError,TypeError): return self.json(400,{"error":"Tanggal atau nilai realisasi tidak valid."})
        if not division or not program or not note or value<0: return self.json(400,{"error":"Semua data wajib diisi dengan benar."})
        partner=str(data.get("partner_name","")).strip()[:160]; route=str(data.get("distribution_route","")).strip()[:80]
        with db() as c:
            created=datetime.now(timezone.utc).isoformat()
            cur=c.execute("INSERT INTO realizations(user_id,division,program,realization_date,value,note,partner_name,distribution_route,created_at) VALUES(?,?,?,?,?,?,?,?,?)",(u["id"],division,program,date,value,note,partner,route,created))
            target=c.execute("SELECT id FROM targets WHERE division=? AND program=? AND active=1 ORDER BY id LIMIT 1",(division,program)).fetchone()
            if target:
                activity_date=datetime.strptime(date,"%Y-%m-%d");week_start=(activity_date-timedelta(days=activity_date.weekday())).date().isoformat()
                c.execute("""INSERT INTO weekly_reports(target_id,user_id,week_start,actual_value,note,created_at) VALUES(?,?,?,?,?,?)
                             ON CONFLICT(target_id,week_start) DO UPDATE SET actual_value=weekly_reports.actual_value+excluded.actual_value,note=excluded.note,user_id=excluded.user_id,created_at=excluded.created_at""",(target["id"],u["id"],week_start,value,note,created))
        return self.json(201,{"ok":True,"id":cur.lastrowid})
    def add_evaluation(self,data):
        u=self.require(csrf=True,roles=("ketua","sekretaris"))
        if not u:return
        finding=str(data.get("finding","")).strip()[:3000]; action=str(data.get("action","")).strip()[:3000]
        if not finding or not action:return self.json(400,{"error":"Temuan dan rencana perbaikan wajib diisi."})
        with db() as c:c.execute("INSERT INTO evaluations(user_id,division,finding,action,created_at) VALUES(?,?,?,?,?)",(u["id"],u["division"],finding,action,datetime.now(timezone.utc).isoformat()))
        return self.json(201,{"ok":True})
    def get_targets(self):
        u = self.require()
        if not u: return
        query = parse_qs(urlparse(self.path).query)
        division = self.scoped_division(u, query.get("division", [""])[0])
        year = query.get("year", [str(datetime.now().year)])[0]
        month = query.get("month", [datetime.now().strftime("%Y-%m")])[0]
        date_from = query.get("date_from", [month + "-01"])[0]
        try:
            start = datetime.strptime(date_from, "%Y-%m-%d")
            date_to = query.get("date_to", [(start.replace(day=28) + timedelta(days=4)).replace(day=1).date().isoformat()])[0]
            date_to = (datetime.strptime(date_to, "%Y-%m-%d") - timedelta(days=1)).date().isoformat() if "date_to" not in query else date_to
        except ValueError: return self.json(400, {"error":"Rentang tanggal tidak valid."})
        sql = """WITH activity AS (
                   SELECT w.target_id,w.week_start activity_date,w.actual_value
                   FROM weekly_reports w WHERE w.note NOT LIKE 'Keuangan:%'
                   UNION ALL
                   SELECT t2.id,tr.transaction_date,tr.amount
                   FROM transactions tr JOIN targets t2 ON t2.division=tr.division AND t2.active=1
                    AND t2.program=CASE tr.category
                      WHEN 'Kotak Amal' THEN 'Penghimpunan Kotak'
                      WHEN 'Tabung Infak' THEN 'Penghimpunan Tabung'
                      WHEN 'Transfer Bank / TF' THEN 'Penghimpunan Transfer / TF'
                      WHEN 'QRIS' THEN 'Penghimpunan QRIS'
                      WHEN 'Zakat' THEN 'Penghimpunan Zakat'
                      WHEN 'Infak / Sedekah' THEN 'Penghimpunan Donasi / Sedekah'
                      WHEN 'Donasi Langsung' THEN 'Penghimpunan Donasi Langsung'
                      ELSE 'Penghimpunan Donasi Lainnya' END
                   WHERE tr.transaction_type='pemasukan'
                 )
                 SELECT t.id,t.division,t.program,t.target_type,t.period,t.target_value,t.unit,t.note,
                 COALESCE(SUM(CASE WHEN substr(a.activity_date,1,4)=? THEN a.actual_value ELSE 0 END),0) actual_year,
                 COALESCE(SUM(CASE WHEN substr(a.activity_date,1,7)=? THEN a.actual_value ELSE 0 END),0) actual_month,
                 COALESCE(SUM(CASE WHEN a.activity_date BETWEEN ? AND ? THEN a.actual_value ELSE 0 END),0) actual_range
                 FROM targets t LEFT JOIN activity a ON a.target_id=t.id
                 WHERE t.active=1"""
        args = [year, month, date_from, date_to]
        if not self.may_manage_all(u) or division:
            sql += " AND t.division=?"; args.append(division)
        sql += " GROUP BY t.id ORDER BY t.id"
        with db() as c: items = [dict(x) for x in c.execute(sql, args)]
        return self.json(200, {"items":items, "division":division, "year":year, "month":month, "date_from":date_from, "date_to":date_to})
    def add_target(self, data):
        u = self.require(csrf=True)
        if not u: return
        division = self.scoped_division(u, data.get("division"))
        program = str(data.get("program", "")).strip()[:160]
        target_type = str(data.get("target_type", "")); period = str(data.get("period", ""))
        unit = str(data.get("unit", "")).strip()[:40]; note = str(data.get("note", "")).strip()[:1000]
        try: value = float(data.get("target_value"))
        except (ValueError, TypeError): return self.json(400, {"error":"Nilai target tidak valid."})
        if not program or target_type not in ("uang","jumlah","aktivitas") or period not in ("mingguan","bulanan","tahunan") or not unit or value < 0:
            return self.json(400, {"error":"Data target belum lengkap atau tidak valid."})
        with db() as c: cur = c.execute("INSERT INTO targets(user_id,division,program,target_type,period,target_value,unit,note,created_at) VALUES(?,?,?,?,?,?,?,?,?)", (u["id"],division,program,target_type,period,value,unit,note,datetime.now(timezone.utc).isoformat()))
        return self.json(201, {"ok":True,"id":cur.lastrowid})
    def update_target(self, data):
        u = self.require(csrf=True)
        if not u: return
        try: target_id=int(data.get("id"));value=float(data.get("target_value"))
        except (ValueError,TypeError):return self.json(400,{"error":"ID atau nilai target tidak valid."})
        program=str(data.get("program","")).strip()[:160];target_type=str(data.get("target_type",""));period=str(data.get("period",""));unit=str(data.get("unit","")).strip()[:40];note=str(data.get("note","")).strip()[:1000]
        if not program or target_type not in ("uang","jumlah","aktivitas") or period not in ("mingguan","bulanan","tahunan") or not unit or value<0:return self.json(400,{"error":"Data target belum lengkap atau tidak valid."})
        with db() as c:
            target=c.execute("SELECT division FROM targets WHERE id=? AND active=1",(target_id,)).fetchone()
            if not target:return self.json(404,{"error":"Target tidak ditemukan."})
            if not self.may_manage_all(u) and target["division"]!=u["division"]:return self.json(403,{"error":"Anda tidak dapat mengedit target divisi lain."})
            division=self.scoped_division(u,data.get("division"))
            c.execute("UPDATE targets SET division=?,program=?,target_type=?,period=?,target_value=?,unit=?,note=? WHERE id=?",(division,program,target_type,period,value,unit,note,target_id))
        return self.json(200,{"ok":True,"id":target_id})
    def add_weekly_report(self, data):
        u = self.require(csrf=True)
        if not u: return
        try: target_id = int(data.get("target_id")); value = float(data.get("actual_value")); week = str(data.get("week_start")); datetime.strptime(week, "%Y-%m-%d")
        except (ValueError, TypeError): return self.json(400, {"error":"Minggu atau nilai capaian tidak valid."})
        with db() as c:
            target = c.execute("SELECT division FROM targets WHERE id=? AND active=1", (target_id,)).fetchone()
            if not target: return self.json(404, {"error":"Target tidak ditemukan."})
            if not self.may_manage_all(u) and target["division"] != u["division"]: return self.json(403, {"error":"Target ini bukan milik divisi Anda."})
            c.execute("""INSERT INTO weekly_reports(target_id,user_id,week_start,actual_value,note,created_at) VALUES(?,?,?,?,?,?)
                         ON CONFLICT(target_id,week_start) DO UPDATE SET actual_value=excluded.actual_value,note=excluded.note,user_id=excluded.user_id,created_at=excluded.created_at""",
                      (target_id,u["id"],week,value,str(data.get("note", "")).strip()[:1000],datetime.now(timezone.utc).isoformat()))
        return self.json(201, {"ok":True})
    def get_donors(self):
        u = self.require()
        if not u: return
        query = parse_qs(urlparse(self.path).query); division = self.scoped_division(u, query.get("division", [""])[0])
        date_from=query.get("date_from",[""])[0];date_to=query.get("date_to",[""])[0]
        sql = "SELECT id,division,name,phone,address,donor_type,status,joined_at,note,placement_type,distribution_route,maps_url,photo_data FROM donors WHERE 1=1"; args=[]
        if date_from and date_to:sql += " AND joined_at BETWEEN ? AND ?";args.extend((date_from,date_to))
        if not self.may_manage_all(u) or division: sql += " AND division=?"; args.append(division)
        sql += " ORDER BY id DESC LIMIT 300"
        with db() as c: items=[dict(x) for x in c.execute(sql,args)]
        return self.json(200,{"items":items})
    def add_donor(self, data):
        u=self.require(csrf=True)
        if not u:return
        division=self.scoped_division(u,data.get("division")); name=str(data.get("name","")).strip()[:120]; joined=str(data.get("joined_at", "")); status=str(data.get("status","aktif"))
        try: datetime.strptime(joined,"%Y-%m-%d")
        except ValueError:return self.json(400,{"error":"Tanggal bergabung tidak valid."})
        if not name or status not in ("aktif","nonaktif"):return self.json(400,{"error":"Data donatur belum lengkap."})
        placement=str(data.get("placement_type","")).strip()[:40];route=str(data.get("distribution_route","")).strip()[:80];maps=str(data.get("maps_url","")).strip()[:500];photo=str(data.get("photo_data", ""))
        if maps and not re.fullmatch(r"https?://.+",maps):return self.json(400,{"error":"Tautan Google Maps harus diawali http:// atau https://."})
        if photo and (len(photo)>4_000_000 or not photo.startswith("data:image/")):return self.json(400,{"error":"Foto lokasi tidak valid atau terlalu besar."})
        with db() as c:cur=c.execute("INSERT INTO donors(user_id,division,name,phone,address,donor_type,status,joined_at,note,placement_type,distribution_route,maps_url,photo_data,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",(u["id"],division,name,str(data.get("phone", "")).strip()[:40],str(data.get("address", "")).strip()[:300],str(data.get("donor_type","Muzaki/Donatur")).strip()[:80],status,joined,str(data.get("note","")).strip()[:1000],placement,route,maps,photo,datetime.now(timezone.utc).isoformat()))
        return self.json(201,{"ok":True,"id":cur.lastrowid})
    def get_transactions(self):
        u=self.require()
        if not u:return
        query=parse_qs(urlparse(self.path).query); division=self.scoped_division(u,query.get("division",[""])[0]); month=query.get("month",[datetime.now().strftime("%Y-%m")])[0];date_from=query.get("date_from",[month+"-01"])[0]
        try:start=datetime.strptime(date_from,"%Y-%m-%d");default_to=((start.replace(day=28)+timedelta(days=4)).replace(day=1)-timedelta(days=1)).date().isoformat()
        except ValueError:return self.json(400,{"error":"Rentang tanggal tidak valid."})
        date_to=query.get("date_to",[default_to])[0]
        sql="SELECT id,division,transaction_date,transaction_type,category,amount,description,source_name,source_class,source_origin,distribution_route FROM transactions WHERE transaction_date BETWEEN ? AND ?"; args=[date_from,date_to]
        if not self.may_manage_all(u) or division:sql+=" AND division=?";args.append(division)
        sql+=" ORDER BY transaction_date DESC,id DESC"
        with db() as c:items=[dict(x) for x in c.execute(sql,args)]
        income=sum(x["amount"] for x in items if x["transaction_type"]=="pemasukan");expense=sum(x["amount"] for x in items if x["transaction_type"]=="pengeluaran")
        return self.json(200,{"items":items,"summary":{"income":income,"expense":expense,"balance":income-expense},"month":month,"date_from":date_from,"date_to":date_to})
    def add_transaction(self,data):
        u=self.require(csrf=True)
        if not u:return
        division=self.scoped_division(u,data.get("division")); tx_type=str(data.get("transaction_type","")); date=str(data.get("date","")); category=str(data.get("category","")).strip()[:100]; description=str(data.get("description","")).strip()[:500]
        try:amount=float(data.get("amount"));datetime.strptime(date,"%Y-%m-%d")
        except (ValueError,TypeError):return self.json(400,{"error":"Tanggal atau nominal transaksi tidak valid."})
        if tx_type not in ("pemasukan","pengeluaran") or not category or not description or amount<0:return self.json(400,{"error":"Data transaksi belum lengkap."})
        source_name=str(data.get("source_name","")).strip()[:160];source_class=str(data.get("source_class","")).strip()[:60];source_origin=str(data.get("source_origin","")).strip()[:80];route=str(data.get("distribution_route","")).strip()[:80]
        if tx_type=="pemasukan" and category=="Kotak Amal" and (not source_name or not route):return self.json(400,{"error":"Pemasukan Kotak Amal wajib mencantumkan titik/toko dan JD."})
        if tx_type=="pemasukan" and category=="Tabung Infak" and (not source_name or not source_class or not source_origin or not route):return self.json(400,{"error":"Pemasukan Tabung Infak wajib mencantumkan nama, kelas, asal unit, dan JD."})
        with db() as c:
            created=datetime.now(timezone.utc).isoformat()
            cur=c.execute("INSERT INTO transactions(user_id,division,transaction_date,transaction_type,category,amount,description,source_name,source_class,source_origin,distribution_route,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",(u["id"],division,date,tx_type,category,amount,description,source_name,source_class,source_origin,route,created))
            if tx_type=="pemasukan":
                program_map={
                    "Kotak Amal":"Penghimpunan Kotak",
                    "Tabung Infak":"Penghimpunan Tabung",
                    "Transfer Bank / TF":"Penghimpunan Transfer / TF",
                    "QRIS":"Penghimpunan QRIS",
                    "Zakat":"Penghimpunan Zakat",
                    "Infak / Sedekah":"Penghimpunan Donasi / Sedekah",
                    "Donasi Langsung":"Penghimpunan Donasi Langsung",
                    "Lainnya":"Penghimpunan Donasi Lainnya",
                }
                program=program_map.get(category,"Penghimpunan Donasi / Sedekah")
                target=c.execute("SELECT id FROM targets WHERE division=? AND program=? AND active=1 ORDER BY id LIMIT 1",(division,program)).fetchone()
                if not target:
                    target_id=c.execute("INSERT INTO targets(user_id,division,program,target_type,period,target_value,unit,note,created_at) VALUES(?,?,?,?,?,?,?,?,?)",(u["id"],division,program,"uang","bulanan",0,"rupiah","Target dibuat otomatis dari pemasukan; silakan edit nilai targetnya.",created)).lastrowid
                else: target_id=target["id"]
                activity_date=datetime.strptime(date,"%Y-%m-%d");week_start=(activity_date-timedelta(days=activity_date.weekday())).date().isoformat()
                finance_note=f"Keuangan: {category} — {description}"
                c.execute("""INSERT INTO weekly_reports(target_id,user_id,week_start,actual_value,note,created_at) VALUES(?,?,?,?,?,?)
                             ON CONFLICT(target_id,week_start) DO UPDATE SET actual_value=weekly_reports.actual_value+excluded.actual_value,note=excluded.note,user_id=excluded.user_id,created_at=excluded.created_at""",(target_id,u["id"],week_start,amount,finance_note,created))
        return self.json(201,{"ok":True,"id":cur.lastrowid})

if __name__ == "__main__":
    generated_password = init_db(); clean_sessions()
    print(f"DDU Control berjalan di http://{HOST}:{PORT}")
    if generated_password: print(f"Password awal akun baru: {generated_password}")
    ThreadingHTTPServer((HOST,PORT),App).serve_forever()
