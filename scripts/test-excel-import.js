'use strict';

const ExcelJS = require('exceljs');
const { buildBudgetReportExport, buildDonorExport, buildExcelTemplate, buildTransactionExport, importDefinitions, parseExcelWorkbook } = require('../excel-import');
const { distributionRoutes } = require('../reference-data');

async function main() {
  for (const [type, definition] of Object.entries(importDefinitions)) {
    const buffer = await buildExcelTemplate(type);
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw Error(`${type}: hasil bukan berkas XLSX.`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const data = workbook.getWorksheet('Data'), guide = workbook.getWorksheet('Petunjuk'), choices = workbook.getWorksheet('_Pilihan');
    if (!data || !guide || !choices || choices.state !== 'veryHidden') throw Error(`${type}: sheet Data, Petunjuk, atau daftar pilihan tidak tersedia.`);
    const headers = definition.columns.map((_, index) => String(data.getCell(1, index + 1).value || ''));
    if (headers.join('|') !== definition.columns.map(column => column.key).join('|')) throw Error(`${type}: urutan kolom tidak sesuai definisi.`);
    if (!definition.columns.some(column => column.options && data.getCell(2, definition.columns.indexOf(column) + 1).dataValidation?.type === 'list' && /^DDU_/.test(data.getCell(2, definition.columns.indexOf(column) + 1).dataValidation.formulae?.[0]))) throw Error(`${type}: daftar pilihan Excel tidak diterapkan.`);
    if (definition.notes?.length && !definition.notes.every(note => String(guide.getCell('A5').value || '').includes(note))) throw Error(`${type}: petunjuk alur data terpusat tidak tersedia.`);

    const rows = await parseExcelWorkbook(buffer.toString('base64'), type);
    if (rows.length !== 1) throw Error(`${type}: contoh data tidak dapat dibaca kembali.`);
    for (const column of definition.columns) {
      if (!Object.prototype.hasOwnProperty.call(rows[0], column.key)) throw Error(`${type}: kolom ${column.key} hilang setelah dibaca.`);
    }
    process.stdout.write(`OK ${type}: ${buffer.length} byte, ${definition.columns.length} kolom\n`);
  }
  if (importDefinitions.realizations.filename !== 'template-realisasi-capaian.xlsx') throw Error('Nama template Realisasi & Capaian belum diselaraskan.');
  for (const type of ['donors', 'incomes', 'realizations']) {
    const routeColumn = importDefinitions[type].columns.find(column => column.key === 'distribution_route');
    if (!routeColumn || routeColumn.options.join('|') !== distributionRoutes.join('|')) throw Error(`${type}: daftar JD belum memakai referensi terpusat.`);
  }
  const expenseKeys = importDefinitions.expenses.columns.map(column => column.key);
  if (!expenseKeys.includes('request_code') || expenseKeys.includes('distribution_route')) throw Error('Template penggunaan anggaran belum terhubung ke kode pengajuan.');
  const incomeKeys = importDefinitions.incomes.columns.map(column => column.key);
  for (const key of ['source_name', 'donor_phone', 'donor_type', 'donation_frequency', 'placement_type']) {
    if (!incomeKeys.includes(key)) throw Error(`Template pemasukan donasi belum memuat kolom profil pusat ${key}.`);
  }
  if (importDefinitions.incomes.filename !== 'template-pemasukan-donasi.xlsx' || importDefinitions.expenses.filename !== 'template-penggunaan-anggaran.xlsx') throw Error('Nama template pembukuan belum diselaraskan.');
  for (const routeName of ['BANTAR KEMANNG-KATULAMPA', 'Kampus 1', 'Kampus 2', 'Kampus 3', 'DDU']) {
    if (!distributionRoutes.includes(routeName)) throw Error(`Referensi JD ${routeName} belum tersedia.`);
  }
  if (new Set(distributionRoutes).size !== distributionRoutes.length || distributionRoutes.includes('BANTAR KRMANNG-KATULAMPA')) throw Error('Daftar JD masih duplikat atau masih memakai ejaan lama.');
  const customizedBuffer = await buildExcelTemplate('donors', { status: ['aktif', 'prospek uji'] });
  const customizedWorkbook = new ExcelJS.Workbook();
  await customizedWorkbook.xlsx.load(customizedBuffer);
  const customizedChoices = customizedWorkbook.getWorksheet('_Pilihan');
  const statusChoiceColumn = customizedChoices.getRow(1).values.indexOf('status');
  if (customizedChoices.getCell(3, statusChoiceColumn).value !== 'prospek uji') throw Error('Template Excel belum mengikuti Data Referensi dinamis.');
  const donorBuffer = await buildDonorExport([{
    name: 'Mitra Uji', division: 'Divisi 1', phone: '08123456789', donor_type: 'Mitra',
    donation_frequency: 'Bulanan', placement_type: 'Kotak Amal', distribution_route: 'BANTAR KEMANG DURIAN RAYA',
    joined_at: '2026-09-07', status: 'aktif', address: 'Alamat uji', maps_url: 'https://maps.google.com/', note: 'Catatan uji'
  }], { scope: 'period', dateFrom: '2026-09-01', dateTo: '2026-09-30', report: 'donations' });
  const donorWorkbook = new ExcelJS.Workbook();
  await donorWorkbook.xlsx.load(donorBuffer);
  const donorSheet = donorWorkbook.getWorksheet('Data Donatur');
  if (!donorSheet || donorSheet.getCell('B5').value !== 'Mitra Uji' || donorSheet.getCell('O5').value?.hyperlink !== 'https://maps.google.com/') throw Error('Ekspor Excel donatur tidak valid.');
  process.stdout.write(`OK donor export: ${donorBuffer.length} byte\n`);
  const transactionBuffer = await buildTransactionExport([{
    division: 'Divisi 1', transaction_date: '2026-09-07', transaction_type: 'pemasukan', category: 'Sedekah',
    amount: 7000000, description: 'Sedekah Online', source_name: '', source_class: '', source_origin: '', distribution_route: ''
  }], { scope: 'period', dateFrom: '2026-09-01', dateTo: '2026-09-30', report: 'donations' });
  const transactionWorkbook = new ExcelJS.Workbook();
  await transactionWorkbook.xlsx.load(transactionBuffer);
  const transactionSheet = transactionWorkbook.getWorksheet('Data Transaksi');
  if (!transactionSheet || transactionSheet.getCell('A1').value !== 'Laporan Pemasukan Donasi DDU' || transactionSheet.getCell('D5').value !== 'Sedekah' || transactionSheet.getCell('M5').value !== 7000000) throw Error('Ekspor Excel pemasukan donasi tidak valid.');
  process.stdout.write(`OK transaction export: ${transactionBuffer.length} byte\n`);
  const budgetBuffer = await buildBudgetReportExport([{
    request_code: 'ANG-UJI-001', division: 'Divisi 1', requester_name: 'Penguji', purpose: 'Program uji', status: 'accountability',
    status_label: 'Proses LPJ', amount: 1000000, disbursed_amount: 1000000, used_amount: 400000, period_used: 400000, remaining_amount: 600000,
    usages: [{ usage_date: '2026-09-08', category: 'Operasional', amount: 400000, description: 'Belanja uji', proof_note: 'KWT-001', recorded_by: 'Penguji' }]
  }], { dateFrom: '2026-09-01', dateTo: '2026-09-30', accessScope: 'central', summary: { requested: 1000000, disbursed: 1000000, used: 400000, outstanding: 600000 } });
  const budgetWorkbook = new ExcelJS.Workbook();
  await budgetWorkbook.xlsx.load(budgetBuffer);
  if (budgetWorkbook.getWorksheet('Ringkasan Anggaran')?.getCell('A5').value !== 'ANG-UJI-001' || budgetWorkbook.getWorksheet('Rincian Penggunaan')?.getCell('E2').value !== 400000) throw Error('Ekspor Excel penggunaan anggaran tidak valid.');
  process.stdout.write(`OK budget report export: ${budgetBuffer.length} byte\n`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
