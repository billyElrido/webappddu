'use strict';

const ExcelJS = require('exceljs');

const divisions = ['Ketua', 'Sekretaris', 'Bendahara', 'Administrasi', 'Divisi 1', 'Divisi 2', 'Divisi 3', 'Dewan Pengawas'];
const donorTypes = ['Muzaki Individu', 'Muzaki Badan / Perusahaan', 'Donatur', 'Calon Donatur', 'Munfik (Pemberi Infak)', 'Mushaddiq (Pemberi Sedekah)', 'Wakif', 'Mitra', 'Mitra UMKM / Titik Kotak', 'Perusahaan / CSR', 'Masjid / Majelis Taklim', 'Pesantren / Lembaga Pendidikan', 'Komunitas / Organisasi', 'Ustadz / Ustadzah', 'Relawan', 'Penerima Manfaat / Mustahik', 'Kontak Lainnya'];
const donationFrequencies = ['Belum rutin', 'Mingguan', 'Bulanan', 'Tahunan / Event', 'Insidental', 'Satu kali', 'Tidak berlaku'];
const placementTypes = ['Kotak Amal', 'Tabung Infak', 'Kotak & Tabung', 'Mitra Proposal / Kerja Sama', 'Calon Mitra', 'Donatur / Calon Donatur', 'Mitra Media / Sponsor', 'Tidak ada'];
const incomeCategories = ['Kotak Amal', 'Tabung Infak', 'Transfer Bank / TF', 'QRIS', 'Zakat Fitrah', 'Zakat Mal', 'Zakat Profesi', 'Infak', 'Sedekah', 'Wakaf Tunai', 'Fidyah', 'Kafarat', 'Donasi Langsung', 'Donasi Barang / Natura', 'Hasil Proposal / Kerja Sama', 'Hibah', 'Bantuan Pemerintah / Lembaga', 'Pendapatan Jasa / Usaha Yayasan', 'Bagi Hasil Bank / Investasi Syariah', 'Pengembalian Dana / Uang Muka', 'Penerimaan Lainnya'];
const expenseCategories = ['Operasional', 'Transportasi', 'Konsumsi', 'Gaji / Honorarium Amil dan Karyawan', 'Penyaluran Zakat', 'Penyaluran Infak / Sedekah', 'Program Pendidikan', 'Program Kesehatan', 'Program Sosial dan Kemanusiaan', 'Program Dakwah / Keagamaan', 'Santunan Mustahik', 'Beasiswa', 'Pembelian Kotak / Tabung', 'Pengadaan Aset / Inventaris', 'ATK dan Perlengkapan Kantor', 'Sewa Gedung / Tempat', 'Listrik, Air, Internet dan Telepon', 'Biaya Administrasi Bank', 'Perawatan dan Perbaikan', 'Publikasi / Konten', 'Fundraising / Penghimpunan', 'Perjalanan Dinas', 'Pajak dan Perizinan', 'Pengeluaran Lainnya'];
const currentYear = new Date().getFullYear();

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
      column('distribution_route', 'Jalur distribusi atau kode JD.', false, 'JD 01', null, 18),
      column('joined_at', 'Tanggal mulai bergabung dengan format tanggal Excel.', true, `${currentYear}-01-15`, null, 16, 'date'),
      column('status', 'Status keaktifan data.', true, 'aktif', ['aktif', 'nonaktif'], 14),
      column('address', 'Alamat lokasi donatur atau mitra.', false, 'Jl. Contoh No. 1', null, 32),
      column('maps_url', 'Tautan Google Maps lengkap, boleh dikosongkan.', false, 'https://maps.google.com/', null, 34, 'text'),
      column('note', 'Catatan tambahan, boleh dikosongkan.', false, 'Titik baru', null, 30)
    ]
  },
  incomes: {
    filename: 'template-pemasukan.xlsx',
    title: 'Pemasukan',
    columns: transactionColumns('pemasukan')
  },
  expenses: {
    filename: 'template-pengeluaran.xlsx',
    title: 'Pengeluaran',
    columns: transactionColumns('pengeluaran')
  },
  targets: {
    filename: 'template-program-target.xlsx',
    title: 'Program & Target',
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
    title: 'Capaian Target',
    columns: [
      column('division', 'Unit/divisi pemilik program.', true, 'Divisi 1', divisions, 20),
      column('program', 'Harus sama persis dengan nama pada Program & Target.', true, 'Distribusi Kotak', null, 32),
      column('date', 'Tanggal capaian dan harus berada pada tahun target.', true, `${currentYear}-01-20`, null, 16, 'date'),
      column('value', 'Nilai capaian kumulatif/periode sesuai target, tanpa satuan.', true, 5, null, 18, 'number'),
      column('note', 'Keterangan capaian.', false, 'Capaian pekan pertama', null, 34)
    ]
  },
  realizations: {
    filename: 'template-realisasi-program.xlsx',
    title: 'Laporan Realisasi',
    columns: [
      column('division', 'Unit/divisi pemilik program.', true, 'Divisi 1', divisions, 20),
      column('program', 'Harus sama persis dengan nama pada Program & Target.', true, 'Penghimpunan Kotak', null, 32),
      column('report_period', 'Jenis periode laporan.', true, 'bulanan', ['mingguan', 'bulanan', 'tahunan'], 18),
      column('date', 'Tanggal laporan dan harus berada pada tahun target.', true, `${currentYear}-01-31`, null, 16, 'date'),
      column('value', 'Nilai realisasi tanpa simbol atau satuan.', true, 2500000, null, 18, 'number'),
      column('partner_name', 'Nama mitra atau titik kotak, boleh dikosongkan.', false, 'Toko Berkah', null, 24),
      column('distribution_route', 'Jalur distribusi atau kode JD.', false, 'JD 01', null, 18),
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
    column('source_name', 'Nama donatur, mitra, pemasok, atau sumber terkait.', false, income ? 'Toko Berkah' : '', null, 24),
    column('source_class', 'Kelas/kelompok sumber, bila digunakan.', false, '', null, 20),
    column('source_origin', 'Asal unit/divisi atau keterangan sumber.', false, '', ['Yayasan', 'DDU', 'Kampus 1', 'Kampus 2', 'Kampus 3', 'Lainnya'], 24),
    column('distribution_route', 'Jalur distribusi atau kode JD.', false, income ? 'JD 01' : '', null, 18)
  ];
}

async function buildExcelTemplate(type) {
  const definition = importDefinitions[type];
  if (!definition) throw httpError('Jenis template tidak dikenali.');
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
    ['Frekuensi', 20], ['Penitipan', 28], ['Jalur Distribusi (JD)', 21], ['Bergabung', 16],
    ['Status', 14], ['Alamat', 36], ['Google Maps', 38], ['Catatan', 34]
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
      item.donation_frequency || '', item.placement_type || '', item.distribution_route || '', excelDate(item.joined_at),
      item.status || '', item.address || '', item.maps_url || '', item.note || ''
    ]);
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell(cell => { cell.border = border('FFD8E6EC'); });
    row.getCell(4).numFmt = '@';
    row.getCell(9).numFmt = 'yyyy-mm-dd';
    if (/^https?:\/\//i.test(String(item.maps_url || ''))) {
      row.getCell(12).value = { text: item.maps_url, hyperlink: item.maps_url };
      row.getCell(12).font = { color: { argb: 'FF0563C1' }, underline: true };
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
  const columns = [
    ['No.', 8], ['Tanggal', 16], ['Jenis', 16], ['Kategori', 34], ['Sumber/Titik', 27],
    ['Kelas', 16], ['Asal', 22], ['Jalur Distribusi (JD)', 22], ['Keterangan', 40],
    ['Nominal', 20], ['Unit/Divisi', 22]
  ];
  sheet.columns = columns.map(([, width]) => ({ width }));
  sheet.mergeCells(1, 1, 1, columns.length);
  sheet.getCell('A1').value = 'Transaksi Keuangan DDU';
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087EA4' } };
  sheet.getCell('A1').alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 32;
  sheet.mergeCells(2, 1, 2, columns.length);
  sheet.getCell('A2').value = metadata.scope === 'all' ? 'Cakupan: Semua transaksi yang dapat diakses akun' : `Cakupan: ${metadata.dateFrom} sampai ${metadata.dateTo}`;
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
      item.source_class || '', item.source_origin || '', item.distribution_route || '', item.description || '',
      Number(item.amount || 0), item.division || ''
    ]);
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell(cell => { cell.border = border('FFD8E6EC'); });
    row.getCell(2).numFmt = 'yyyy-mm-dd';
    row.getCell(10).numFmt = '"Rp" #,##0';
    row.getCell(3).font = { bold: true, color: { argb: item.transaction_type === 'pemasukan' ? 'FF177A5B' : 'FFB34541' } };
  });
  sheet.autoFilter = { from: 'A4', to: sheet.getCell(4, columns.length).address };
  sheet.getColumn(1).alignment = { horizontal: 'center' };
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

module.exports = { buildDonorExport, buildExcelTemplate, buildTransactionExport, importDefinitions, parseExcelWorkbook };
