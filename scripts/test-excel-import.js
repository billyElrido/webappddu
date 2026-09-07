'use strict';

const ExcelJS = require('exceljs');
const { buildDonorExport, buildExcelTemplate, buildTransactionExport, importDefinitions, parseExcelWorkbook } = require('../excel-import');

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

    const rows = await parseExcelWorkbook(buffer.toString('base64'), type);
    if (rows.length !== 1) throw Error(`${type}: contoh data tidak dapat dibaca kembali.`);
    for (const column of definition.columns) {
      if (!Object.prototype.hasOwnProperty.call(rows[0], column.key)) throw Error(`${type}: kolom ${column.key} hilang setelah dibaca.`);
    }
    process.stdout.write(`OK ${type}: ${buffer.length} byte, ${definition.columns.length} kolom\n`);
  }
  const donorBuffer = await buildDonorExport([{
    name: 'Mitra Uji', division: 'Divisi 1', phone: '08123456789', donor_type: 'Mitra',
    donation_frequency: 'Bulanan', placement_type: 'Kotak Amal', distribution_route: 'JD 01',
    joined_at: '2026-09-07', status: 'aktif', address: 'Alamat uji', maps_url: 'https://maps.google.com/', note: 'Catatan uji'
  }], { scope: 'period', dateFrom: '2026-09-01', dateTo: '2026-09-30' });
  const donorWorkbook = new ExcelJS.Workbook();
  await donorWorkbook.xlsx.load(donorBuffer);
  const donorSheet = donorWorkbook.getWorksheet('Data Donatur');
  if (!donorSheet || donorSheet.getCell('B5').value !== 'Mitra Uji' || donorSheet.getCell('L5').value?.hyperlink !== 'https://maps.google.com/') throw Error('Ekspor Excel donatur tidak valid.');
  process.stdout.write(`OK donor export: ${donorBuffer.length} byte\n`);
  const transactionBuffer = await buildTransactionExport([{
    division: 'Divisi 1', transaction_date: '2026-09-07', transaction_type: 'pemasukan', category: 'Sedekah',
    amount: 7000000, description: 'Sedekah Online', source_name: '', source_class: '', source_origin: '', distribution_route: ''
  }], { scope: 'period', dateFrom: '2026-09-01', dateTo: '2026-09-30' });
  const transactionWorkbook = new ExcelJS.Workbook();
  await transactionWorkbook.xlsx.load(transactionBuffer);
  const transactionSheet = transactionWorkbook.getWorksheet('Data Transaksi');
  if (!transactionSheet || transactionSheet.getCell('D5').value !== 'Sedekah' || transactionSheet.getCell('J5').value !== 7000000) throw Error('Ekspor Excel transaksi tidak valid.');
  process.stdout.write(`OK transaction export: ${transactionBuffer.length} byte\n`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
