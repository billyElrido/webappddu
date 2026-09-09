'use strict';

const ExcelJS = require('exceljs');
const { distributionRoutes, donorStatuses, donorTypes, donationFrequencies, placementTypes, sourceOrigins, educationLevels, schoolClasses } = require('./reference-data');

const divisions = ['Ketua', 'Sekretaris', 'Bendahara', 'Administrasi', 'Divisi 1', 'Divisi 2', 'Divisi 3', 'Dewan Pengawas'];
const incomeCategories = ['Kotak Amal', 'Tabung Infak', 'Transfer Bank / TF', 'QRIS', 'Zakat Fitrah', 'Zakat Mal', 'Zakat Profesi', 'Infak', 'Sedekah', 'Wakaf Tunai', 'Fidyah', 'Kafarat', 'Donasi Langsung', 'Donasi Barang / Natura', 'Hasil Proposal / Kerja Sama', 'Hibah', 'Bantuan Pemerintah / Lembaga', 'Pendapatan Jasa / Usaha Yayasan', 'Bagi Hasil Bank / Investasi Syariah', 'Pengembalian Dana / Uang Muka', 'Penerimaan Lainnya'];
const expenseCategories = ['Operasional', 'Transportasi', 'Konsumsi', 'Gaji / Honorarium Amil dan Karyawan', 'Penyaluran Zakat', 'Penyaluran Infak / Sedekah', 'Program Pendidikan', 'Program Kesehatan', 'Program Sosial dan Kemanusiaan', 'Program Dakwah / Keagamaan', 'Santunan Mustahik', 'Beasiswa', 'Pembelian Kotak / Tabung', 'Pengadaan Aset / Inventaris', 'ATK dan Perlengkapan Kantor', 'Sewa Gedung / Tempat', 'Listrik, Air, Internet dan Telepon', 'Biaya Administrasi Bank', 'Perawatan dan Perbaikan', 'Publikasi / Konten', 'Fundraising / Penghimpunan', 'Perjalanan Dinas', 'Pajak dan Perizinan', 'Pengeluaran Lainnya'];
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();
const academicStartYear = currentMonth >= 6 ? currentYear : currentYear - 1;
const currentAcademicYear = `${academicStartYear}-${academicStartYear + 1}`;

const importDefinitions = {
  donors: {
    filename: 'template-data-donatur.xlsx',
    title: 'Data Donatur & Mitra',
    columns: [
      column('division', 'Unit/divisi pemilik data.', true, 'Divisi 1', divisions, 20),
      column('name', 'Nama donatur, muzaki, atau mitra.', true, 'Toko Berkah', null, 25),
      column('phone', 'Nomor telepon. Awali dengan tanda petik jika diperlukan.', false, '08123456789', null, 18, 'text'),
      column('donor_type', 'Jenis kontak.', false, 'Mitra UMKM / Titik Kotak', donorTypes, 28),
      column('donation_frequency', 'Frekuensi donasi atau penghimpunan.', false, 'Bulanan', donationFrequencies, 20),
      column('placement_type', 'Sarana atau bentuk hubungan dengan lokasi.', false, 'Kotak Amal', placementTypes, 28),
      column('distribution_route', 'Pilih Jalur Distribusi (JD) dari daftar terpusat.', false, distributionRoutes[0], distributionRoutes, 30),
      column('education_level', 'Jenjang pendidikan siswa. Kosongkan jika bukan data siswa.', false, 'MTs', educationLevels, 20),
      column('class_name', 'Kelas/rombel sesuai jenjang.', false, 'MTs 7A', schoolClasses, 20),
      column('academic_year', 'Tahun ajaran penempatan kelas.', false, currentAcademicYear, [currentAcademicYear], 18),
      column('joined_at', 'Tanggal mulai bergabung dengan format tanggal Excel.', true, `${currentYear}-01-15`, null, 16, 'date'),
      column('status', 'Status keaktifan data.', true, 'aktif', donorStatuses, 14),
      column('address', 'Alamat lokasi donatur atau mitra.', false, 'Jl. Contoh No. 1', null, 32),
      column('maps_url', 'Tautan Google Maps lengkap, boleh dikosongkan.', false, 'https://maps.google.com/', null, 34, 'text'),
      column('note', 'Catatan tambahan, boleh dikosongkan.', false, 'Titik baru', null, 30)
    ]
  },
  incomes: {
    filename: 'template-pemasukan-donasi.xlsx',
    title: 'Pemasukan Donasi per Donatur/Mitra',
    notes: [
      'Isi nama donatur/mitra pada setiap baris. Jika nama sudah ada pada unit yang sama, donasi otomatis ditambahkan sebagai transaksi berulang pada profil tersebut.',
      'Jika nama belum ada, sistem otomatis membuat profil baru pada Data Donatur/Mitra. Kolom telepon, jenis, frekuensi, dan penitipan digunakan untuk melengkapi profil baru.'
    ],
    columns: transactionColumns('pemasukan')
  },
  expenses: {
    filename: 'template-penggunaan-anggaran.xlsx',
    title: 'Pembukuan Penggunaan Anggaran',
    notes: [
      'Setiap baris wajib memakai kode pengajuan anggaran yang sudah dicairkan.',
      'Nilai penggunaan tidak boleh melebihi sisa dana pada pengajuan. Data tersimpan pada LPJ anggaran dan laporan keuangan pusat tanpa pencatatan ganda.'
    ],
    columns: [
      column('division', 'Unit/divisi pemilik pengajuan anggaran.', true, 'Divisi 1', divisions, 20),
      column('request_code', 'Kode pengajuan yang sudah dicairkan, misalnya ANG-20260909-ABC123.', true, 'ANG-20260909-ABC123', null, 28, 'text'),
      column('date', 'Tanggal penggunaan anggaran.', true, `${currentYear}-01-16`, null, 16, 'date'),
      column('category', 'Kategori belanja atau pelaksanaan program.', true, 'Operasional', expenseCategories, 34),
      column('amount', 'Nominal penggunaan tanpa simbol Rp atau pemisah ribuan.', true, 500000, null, 18, 'number'),
      column('description', 'Rincian penggunaan anggaran.', true, 'Transportasi distribusi', null, 36),
      column('proof_note', 'Nomor kuitansi, tautan bukti, atau keterangan dokumen.', false, 'KWT-001', null, 30)
    ]
  },
  targets: {
    filename: 'template-program-target.xlsx',
    title: 'Program & Target',
    notes: [
      'Template ini hanya menetapkan program dan nilai target. Capaian target jumlah/aktivitas diimpor melalui template Realisasi & Capaian.',
      'Realisasi target uang tidak diisi sebagai capaian manual; sistem menghitungnya otomatis dari data Pemasukan pada unit, program, dan tahun yang sesuai.'
    ],
    columns: [
      column('division', 'Unit/divisi pemilik program.', true, 'Divisi 1', divisions, 20),
      column('target_year', 'Tahun buku target.', true, currentYear, null, 14, 'integer'),
      column('program', 'Nama program atau indikator. Gunakan nama yang konsisten.', true, 'Penghimpunan QRIS', null, 32),
      column('target_type', 'Jenis pengukuran target.', true, 'uang', ['uang', 'jumlah', 'aktivitas'], 18),
      column('period', 'Frekuensi nilai target yang dimasukkan.', true, 'bulanan', ['mingguan', 'bulanan', 'tahunan'], 16),
      column('target_value', 'Nilai target sesuai periode, tanpa simbol Rp atau pemisah ribuan.', true, 10000000, null, 18, 'number'),
      column('unit', 'Satuan nilai, misalnya rupiah, kotak, surat, atau kegiatan.', true, 'rupiah', null, 20),
      column('note', 'Catatan target, boleh dikosongkan.', false, 'Target penghimpunan QRIS', null, 34)
    ]
  },
  achievements: {
    filename: 'template-capaian-target.xlsx',
    title: 'Capaian Target (Kompatibilitas File Lama)',
    notes: [
      'Template lama ini tetap dapat diunggah untuk menjaga kompatibilitas. Data yang masuk akan dicatat ke Realisasi & Capaian terpusat.',
      'Untuk data baru, gunakan template Realisasi & Capaian agar periode laporan, mitra/JD, catatan, dan SWOT tersimpan lengkap.',
      'Target uang wajib direalisasikan melalui template Pemasukan dan tidak boleh dimasukkan pada template ini.'
    ],
    columns: [
      column('division', 'Unit/divisi pemilik program.', true, 'Divisi 1', divisions, 20),
      column('program', 'Harus sama persis dengan nama pada Program & Target.', true, 'Distribusi Kotak', null, 32),
      column('date', 'Tanggal capaian dan harus berada pada tahun target.', true, `${currentYear}-01-20`, null, 16, 'date'),
      column('value', 'Nilai capaian kumulatif/periode sesuai target, tanpa satuan.', true, 5, null, 18, 'number'),
      column('note', 'Keterangan capaian.', false, 'Capaian pekan pertama', null, 34)
    ]
  },
  realizations: {
    filename: 'template-realisasi-capaian.xlsx',
    title: 'Realisasi & Capaian Program',
    notes: [
      'Ini adalah satu pintu impor realisasi untuk target jumlah dan aktivitas. Setiap baris tersimpan sebagai laporan serta langsung memperbarui capaian dashboard pusat.',
      'Kolom value berisi capaian baru pada tanggal tersebut, bukan total kumulatif. Jangan memasukkan hasil yang sama lagi pada laporan mingguan, bulanan, atau tahunan.',
      'Target uang/ZISW/donasi dihitung otomatis dari template Pemasukan; jangan memasukkan nominal penghimpunan pada template ini.',
      'Nama division dan program harus sama dengan Program & Target aktif pada tahun tanggal laporan.'
    ],
    columns: [
      column('division', 'Unit/divisi pemilik program.', true, 'Divisi 1', divisions, 20),
      column('program', 'Harus sama persis dengan nama pada Program & Target aktif.', true, 'Distribusi Kotak', null, 32),
      column('report_period', 'Jenis periode laporan.', true, 'bulanan', ['mingguan', 'bulanan', 'tahunan'], 18),
      column('date', 'Tanggal laporan dan harus berada pada tahun target.', true, `${currentYear}-01-31`, null, 16, 'date'),
      column('value', 'Capaian baru pada tanggal ini, bukan total kumulatif. Nilai langsung memperbarui dashboard.', true, 5, null, 18, 'number'),
      column('partner_name', 'Nama mitra atau titik kotak, boleh dikosongkan.', false, 'Toko Berkah', null, 24),
      column('distribution_route', 'Pilih Jalur Distribusi (JD) dari daftar terpusat.', false, distributionRoutes[0], distributionRoutes, 30),
      column('note', 'Ringkasan hasil, kendala, atau progres.', true, 'Laporan realisasi bulanan', null, 34),
      column('swot_strengths', 'Wajib untuk laporan bulanan/tahunan.', false, 'Jaringan titik aktif', null, 30),
      column('swot_weaknesses', 'Wajib untuk laporan bulanan/tahunan.', false, 'Penarikan belum merata', null, 30),
      column('swot_opportunities', 'Wajib untuk laporan bulanan/tahunan.', false, 'Penambahan mitra baru', null, 30),
      column('swot_threats', 'Wajib untuk laporan bulanan/tahunan.', false, 'Mitra berpotensi tidak aktif', null, 30)
    ]
  }
};

function column(key, help, required, example, options = null, width = 20, format = 'text') {
  return { key, help, required, example, options, width, format };
}

function transactionColumns(kind) {
  const income = kind === 'pemasukan';
  return [
    column('division', 'Unit/divisi asal transaksi.', true, 'Divisi 1', divisions, 20),
    column('date', 'Tanggal transaksi.', true, `${currentYear}-01-${income ? '15' : '16'}`, null, 16, 'date'),
    column('category', 'Kategori transaksi.', true, income ? 'Kotak Amal' : 'Operasional', income ? incomeCategories : expenseCategories, 34),
    column('amount', 'Nominal angka tanpa simbol Rp atau pemisah ribuan.', true, income ? 2500000 : 500000, null, 18, 'number'),
    column('description', 'Keterangan transaksi.', true, income ? 'Penarikan kotak mingguan' : 'Transportasi distribusi', null, 34),
    column('source_name', income?'Nama donatur/mitra. Gunakan nama yang sama dengan Data Donatur agar transaksi terhubung otomatis.':'Nama pemasok atau sumber terkait.', income, income ? 'Toko Berkah' : '', null, 24),
    ...(income ? [
      column('donor_phone', 'Nomor telepon untuk profil baru. Boleh dikosongkan untuk donatur yang sudah ada.', false, '08123456789', null, 18, 'text'),
      column('donor_type', 'Jenis donatur/mitra untuk profil baru.', false, 'Donatur', donorTypes, 28),
      column('donation_frequency', 'Pola donasi untuk profil baru.', false, 'Belum rutin', donationFrequencies, 20),
      column('placement_type', 'Jenis penitipan atau hubungan untuk profil baru.', false, 'Donatur / Calon Donatur', placementTypes, 28)
    ] : []),
    column('education_level', 'Jenjang pendidikan sumber, bila digunakan.', false, '', educationLevels, 20),
    column('source_class', 'Kelas/kelompok sumber, bila digunakan.', false, '', schoolClasses, 20),
    column('academic_year', 'Tahun ajaran sumber, bila digunakan.', false, '', [currentAcademicYear], 18),
    column('source_origin', 'Asal unit/divisi atau keterangan sumber.', false, '', sourceOrigins, 24),
    column('distribution_route', 'Pilih Jalur Distribusi (JD) dari daftar terpusat.', false, income ? distributionRoutes[0] : '', distributionRoutes, 30)
  ];
}

async function buildExcelTemplate(type, optionOverrides = {}) {
  const sourceDefinition = importDefinitions[type];
  if (!sourceDefinition) throw httpError('Jenis template tidak dikenali.');
  const definition = {
    ...sourceDefinition,
    columns: sourceDefinition.columns.map(item => ({ ...item, options: optionOverrides[item.key] || item.options }))
  };
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DDU Control';
  workbook.company = 'Dompet Dana Umat';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const data = workbook.addWorksheet('Data', {
    properties: { defaultRowHeight: 20 },
    views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }]
  });
  data.columns = definition.columns.map(item => ({ header: item.key, key: item.key, width: item.width }));
  data.addRow(Object.fromEntries(definition.columns.map(item => [item.key, item.example])));
  data.autoFilter = { from: 'A1', to: data.getCell(1, definition.columns.length).address };
  data.getRow(1).height = 30;
  data.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087EA4' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border('FFB7D7E2');
  });
  data.getRow(2).height = 34;
  data.getRow(2).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF6FA' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = border('FFD8E6EC');
  });
  const choices = workbook.addWorksheet('_Pilihan');
  const optionNames = new Map();
  definition.columns.filter(item => item.options).forEach((item, optionIndex) => {
    const columnNumber = optionIndex + 1, excelColumn = choices.getColumn(columnNumber).letter;
    choices.getCell(1, columnNumber).value = item.key;
    item.options.forEach((option, rowIndex) => { choices.getCell(rowIndex + 2, columnNumber).value = option; });
    const rangeName = `DDU_${type}_${item.key}`.replace(/[^A-Za-z0-9_]/g, '_');
    workbook.definedNames.add(`_Pilihan!$${excelColumn}$2:$${excelColumn}$${item.options.length + 1}`, rangeName);
    optionNames.set(item.key, rangeName);
  });
  choices.state = 'veryHidden';
  definition.columns.forEach((item, index) => {
    const columnNumber = index + 1;
    const header = data.getCell(1, columnNumber);
    if (item.required) header.font = { ...header.font, color: { argb: 'FFFFFFCC' } };
    for (let row = 2; row <= 201; row++) {
      const cell = data.getCell(row, columnNumber);
      if (item.format === 'date') cell.numFmt = 'yyyy-mm-dd';
      else if (item.format === 'number') cell.numFmt = '#,##0.00';
      else if (item.format === 'integer') cell.numFmt = '0';
      else cell.numFmt = '@';
      if (item.options) cell.dataValidation = {
        type: 'list',
        allowBlank: !item.required,
        formulae: [optionNames.get(item.key)],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Pilihan tidak valid',
        error: 'Pilih salah satu nilai yang tersedia pada daftar.',
        showInputMessage: true,
        promptTitle: item.key,
        prompt: item.help.slice(0, 250)
      };
    }
  });

  const guide = workbook.addWorksheet('Petunjuk', { views: [{ state: 'frozen', ySplit: 5 }] });
  guide.columns = [{ width: 24 }, { width: 13 }, { width: 58 }, { width: 34 }];
  guide.mergeCells('A1:D1');
  guide.getCell('A1').value = `Template Impor DDU — ${definition.title}`;
  guide.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  guide.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087EA4' } };
  guide.getCell('A1').alignment = { vertical: 'middle' };
  guide.getRow(1).height = 32;
  guide.mergeCells('A2:D2');
  guide.getCell('A2').value = 'Isi atau edit baris pada sheet Data. Jangan mengubah nama kolom pada baris pertama.';
  guide.mergeCells('A3:D3');
  guide.getCell('A3').value = 'Baris kedua adalah contoh dan boleh diganti atau dihapus. Maksimal 200 baris data per unggahan.';
  guide.mergeCells('A4:D4');
  guide.getCell('A4').value = 'Simpan sebagai Excel Workbook (.xlsx). Google Sheets: File → Download → Microsoft Excel (.xlsx).';
  if (definition.notes?.length) {
    guide.mergeCells('A5:D5');
    guide.getCell('A5').value = definition.notes.map((note, index) => `${index + 1}. ${note}`).join('\n');
    guide.getCell('A5').alignment = { vertical: 'top', wrapText: true };
    guide.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4D6' } };
    guide.getCell('A5').border = border('FFE7C66B');
    guide.getRow(5).height = Math.max(42, definition.notes.length * 30);
  }
  const headerRow = guide.addRow(['Nama kolom', 'Wajib', 'Petunjuk', 'Contoh']);
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF125B82' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  definition.columns.forEach(item => {
    const row = guide.addRow([item.key, item.required ? 'Ya' : 'Tidak', item.help + (item.options ? ` Pilihan: ${item.options.join(' / ')}.` : ''), String(item.example ?? '')]);
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell(cell => { cell.border = border('FFD8E6EC'); });
  });
  guide.getColumn(2).alignment = { horizontal: 'center', vertical: 'top' };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function parseExcelWorkbook(base64, type) {
  const definition = importDefinitions[type];
  if (!definition) throw httpError('Jenis impor Excel tidak dikenali.');
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw httpError('Berkas Excel tidak valid.');
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) throw httpError('Ukuran berkas Excel maksimal 2 MB.');
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw httpError('Berkas harus berupa Excel Workbook (.xlsx).');
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw httpError('Berkas Excel rusak, terenkripsi, atau tidak dapat dibaca.');
  }
  const worksheet = workbook.getWorksheet('Data') || workbook.worksheets[0];
  if (!worksheet) throw httpError('Sheet Data tidak ditemukan.');
  if (worksheet.rowCount > 1000 || worksheet.columnCount > 50) throw httpError('Ukuran sheet melebihi batas impor.');
  const expectedHeaders = definition.columns.map(item => item.key);
  const headers = expectedHeaders.map((_, index) => normalizeHeader(worksheet.getCell(1, index + 1).value));
  const missing = expectedHeaders.filter(header => !headers.includes(header));
  if (missing.length) throw httpError(`Kolom template tidak lengkap: ${missing.join(', ')}.`);
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) throw httpError('Nama kolom pada sheet Data tidak boleh ganda.');
  const rows = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const values = {};
    let hasData = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const value = normalizeExcelValue(worksheet.getCell(rowNumber, index + 1).value, rowNumber, header);
      values[header] = value;
      if (value !== '') hasData = true;
    });
    if (hasData) rows.push(values);
    if (rows.length > 200) throw httpError('Maksimal 200 baris data per berkas.');
  }
  if (!rows.length) throw httpError('Sheet Data tidak memiliki baris untuk diimpor.');
  return rows;
}

async function buildDonorExport(rows, metadata = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DDU Control';
  workbook.company = 'Dompet Dana Umat';
  workbook.created = new Date();
  workbook.modified = new Date();
  const sheet = workbook.addWorksheet('Data Donatur', {
    properties: { defaultRowHeight: 20 },
    views: [{ state: 'frozen', ySplit: 4, activeCell: 'A5' }]
  });
  const columns = [
    ['No.', 8], ['Nama', 26], ['Asal unit/divisi', 22], ['Telepon', 19], ['Jenis kontak', 29],
    ['Frekuensi', 20], ['Penitipan', 28], ['Jalur Distribusi (JD)', 21], ['Jenjang', 14],
    ['Kelas', 16], ['Tahun Ajaran', 18], ['Bergabung', 16], ['Status', 14], ['Alamat', 36], ['Google Maps', 38], ['Catatan', 34]
  ];
  sheet.columns = columns.map(([, width]) => ({ width }));
  sheet.mergeCells(1, 1, 1, columns.length);
  sheet.getCell('A1').value = 'Daftar Donatur & Mitra DDU';
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087EA4' } };
  sheet.getCell('A1').alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 32;
  sheet.mergeCells(2, 1, 2, columns.length);
  sheet.getCell('A2').value = metadata.scope === 'all' ? 'Cakupan: Semua data yang dapat diakses akun' : `Cakupan: ${metadata.dateFrom} sampai ${metadata.dateTo}`;
  sheet.getCell('A2').font = { italic: true, color: { argb: 'FF52616B' } };
  sheet.mergeCells(3, 1, 3, columns.length);
  sheet.getCell('A3').value = `Diunduh: ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date())} WIB`;
  sheet.getCell('A3').font = { color: { argb: 'FF52616B' } };
  const header = sheet.getRow(4);
  header.values = columns.map(([label]) => label);
  header.height = 30;
  header.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF125B82' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border('FFB7D7E2');
  });
  rows.forEach((item, index) => {
    const row = sheet.addRow([
      index + 1, item.name || '', item.division || '', item.phone || '', item.donor_type || '',
      item.donation_frequency || '', item.placement_type || '', item.distribution_route || '', item.education_level || '',
      item.current_class || '', item.academic_year || '', excelDate(item.joined_at), item.status || '', item.address || '', item.maps_url || '', item.note || ''
    ]);
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell(cell => { cell.border = border('FFD8E6EC'); });
    row.getCell(4).numFmt = '@';
    row.getCell(12).numFmt = 'yyyy-mm-dd';
    if (/^https?:\/\//i.test(String(item.maps_url || ''))) {
      row.getCell(15).value = { text: item.maps_url, hyperlink: item.maps_url };
      row.getCell(15).font = { color: { argb: 'FF0563C1' }, underline: true };
    }
  });
  sheet.autoFilter = { from: 'A4', to: sheet.getCell(4, columns.length).address };
  sheet.getColumn(1).alignment = { horizontal: 'center' };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function buildTransactionExport(rows, metadata = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DDU Control';
  workbook.company = 'Dompet Dana Umat';
  workbook.created = new Date();
  workbook.modified = new Date();
  const sheet = workbook.addWorksheet('Data Transaksi', {
    properties: { defaultRowHeight: 20 },
    views: [{ state: 'frozen', ySplit: 4, activeCell: 'A5' }]
  });
  const donationReport = metadata.report === 'donations';
  const columns = [
    ['No.', 8], ['Tanggal', 16], ['Jenis', 16], ['Kategori', 34], [donationReport ? 'Donatur/Mitra' : 'Sumber/Titik', 27],
    ['Keterhubungan Data', 22], ['Jenjang', 14], ['Kelas', 16], ['Tahun Ajaran', 18], ['Asal', 22], ['Jalur Distribusi (JD)', 22],
    ['Keterangan', 40], ['Nominal', 20], ['Unit/Divisi', 22]
  ];
  sheet.columns = columns.map(([, width]) => ({ width }));
  sheet.mergeCells(1, 1, 1, columns.length);
  sheet.getCell('A1').value = donationReport ? 'Laporan Pemasukan Donasi DDU' : 'Transaksi Keuangan DDU';
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087EA4' } };
  sheet.getCell('A1').alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 32;
  sheet.mergeCells(2, 1, 2, columns.length);
  sheet.getCell('A2').value = metadata.scope === 'all' ? `Cakupan: Semua ${donationReport ? 'pemasukan donasi' : 'transaksi'} yang dapat diakses akun` : `Cakupan: ${metadata.dateFrom} sampai ${metadata.dateTo}`;
  sheet.getCell('A2').font = { italic: true, color: { argb: 'FF52616B' } };
  sheet.mergeCells(3, 1, 3, columns.length);
  sheet.getCell('A3').value = `Diunduh: ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date())} WIB`;
  sheet.getCell('A3').font = { color: { argb: 'FF52616B' } };
  const header = sheet.getRow(4);
  header.values = columns.map(([label]) => label);
  header.height = 30;
  header.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF125B82' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border('FFB7D7E2');
  });
  rows.forEach((item, index) => {
    const row = sheet.addRow([
      index + 1, excelDate(item.transaction_date), item.transaction_type || '', item.category || '', item.source_name || '',
      item.donor_id ? `Terhubung · ${item.linked_donor_type || 'Donatur/Mitra'}` : 'Sumber manual',
      item.source_education_level || '', item.source_class || '', item.academic_year || '', item.source_origin || '',
      item.distribution_route || '', item.description || '', Number(item.amount || 0), item.division || ''
    ]);
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell(cell => { cell.border = border('FFD8E6EC'); });
    row.getCell(2).numFmt = 'yyyy-mm-dd';
    row.getCell(13).numFmt = '"Rp" #,##0';
    row.getCell(3).font = { bold: true, color: { argb: item.transaction_type === 'pemasukan' ? 'FF177A5B' : 'FFB34541' } };
  });
  sheet.autoFilter = { from: 'A4', to: sheet.getCell(4, columns.length).address };
  sheet.getColumn(1).alignment = { horizontal: 'center' };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function buildBudgetReportExport(rows, metadata = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DDU Control';
  workbook.company = 'Dompet Dana Umat';
  workbook.created = new Date();
  workbook.modified = new Date();
  const columns = [
    ['Kode Pengajuan', 27], ['Unit/Divisi', 20], ['Pengaju', 24], ['Tujuan Penggunaan', 42], ['Status', 21],
    ['Diajukan', 18], ['Dicairkan', 18], ['Digunakan Total', 18], ['Digunakan Periode', 19], ['Sisa/Belum LPJ', 18]
  ];
  const sheet = workbook.addWorksheet('Ringkasan Anggaran', { views: [{ state: 'frozen', ySplit: 4, activeCell: 'A5' }] });
  sheet.columns = columns.map(([, width]) => ({ width }));
  sheet.mergeCells(1, 1, 1, columns.length);
  sheet.getCell('A1').value = 'Laporan Pengajuan dan Penggunaan Anggaran DDU';
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087EA4' } };
  sheet.getCell('A1').alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 32;
  sheet.mergeCells(2, 1, 2, columns.length);
  sheet.getCell('A2').value = `Periode: ${metadata.dateFrom || '-'} sampai ${metadata.dateTo || '-'} · Ruang data: ${metadata.accessScope === 'central' ? 'Terpusat' : 'Unit akun'}`;
  sheet.getCell('A2').font = { italic: true, color: { argb: 'FF52636E' } };
  sheet.mergeCells(3, 1, 3, columns.length);
  const summary = metadata.summary || {};
  sheet.getCell('A3').value = `Diajukan ${Number(summary.requested || 0).toLocaleString('id-ID')} · Dicairkan ${Number(summary.disbursed || 0).toLocaleString('id-ID')} · Digunakan ${Number(summary.used || 0).toLocaleString('id-ID')} · Belum LPJ ${Number(summary.outstanding || 0).toLocaleString('id-ID')}`;
  sheet.getCell('A3').font = { color: { argb: 'FF52636E' } };
  const header = sheet.getRow(4);
  header.values = columns.map(([label]) => label);
  header.height = 30;
  header.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF125B82' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border('FFB7D7E2');
  });
  rows.forEach(item => {
    const row = sheet.addRow([
      item.request_code || '', item.division || '', item.requester_name || '', item.purpose || '', item.status_label || item.status || '',
      Number(item.amount || 0), Number(item.disbursed_amount || 0), Number(item.used_amount || 0), Number(item.period_used || 0), Number(item.remaining_amount || 0)
    ]);
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell(cell => { cell.border = border('FFD8E6EC'); });
    for (let column = 6; column <= 10; column++) row.getCell(column).numFmt = '"Rp" #,##0';
  });
  sheet.autoFilter = { from: 'A4', to: sheet.getCell(4, columns.length).address };

  const usageColumns = [
    ['Kode Pengajuan', 27], ['Unit/Divisi', 20], ['Tanggal', 16], ['Kategori', 30], ['Nominal', 18],
    ['Rincian Penggunaan', 42], ['Bukti', 28], ['Dicatat Oleh', 24]
  ];
  const details = workbook.addWorksheet('Rincian Penggunaan', { views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }] });
  details.columns = usageColumns.map(([, width]) => ({ width }));
  const detailHeader = details.addRow(usageColumns.map(([label]) => label));
  detailHeader.height = 30;
  detailHeader.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087EA4' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border('FFB7D7E2');
  });
  for (const item of rows) for (const usage of item.usages || []) {
    const row = details.addRow([
      item.request_code || '', item.division || '', excelDate(usage.usage_date), usage.category || '', Number(usage.amount || 0),
      usage.description || '', usage.proof_note || '', usage.recorded_by || ''
    ]);
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell(cell => { cell.border = border('FFD8E6EC'); });
    row.getCell(3).numFmt = 'yyyy-mm-dd';
    row.getCell(5).numFmt = '"Rp" #,##0';
  }
  details.autoFilter = { from: 'A1', to: details.getCell(1, usageColumns.length).address };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function normalizeHeader(value) {
  return String(value == null ? '' : value).replace(/^\ufeff/, '').trim();
}

function normalizeExcelValue(value, rowNumber, header) {
  if (value == null) return '';
  if (value instanceof Date) return localDate(value);
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value.richText)) return value.richText.map(item => item.text || '').join('').trim();
  if (Object.prototype.hasOwnProperty.call(value, 'formula') || Object.prototype.hasOwnProperty.call(value, 'sharedFormula')) throw httpError(`Baris ${rowNumber}, kolom ${header}: rumus Excel tidak didukung. Isi dengan nilai biasa.`);
  if (Object.prototype.hasOwnProperty.call(value, 'hyperlink')) return String(value.text || value.hyperlink || '').trim();
  if (Object.prototype.hasOwnProperty.call(value, 'result')) return normalizeExcelValue(value.result, rowNumber, header);
  throw httpError(`Baris ${rowNumber}, kolom ${header}: tipe isi sel tidak didukung.`);
}

function localDate(value) {
  const pad = number => String(number).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function excelDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : String(value || '');
}

function border(color) {
  return {
    top: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } }
  };
}

function httpError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

module.exports = { buildBudgetReportExport, buildDonorExport, buildExcelTemplate, buildTransactionExport, importDefinitions, parseExcelWorkbook };
