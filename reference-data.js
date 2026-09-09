'use strict';

(function exposeReferenceData(root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  if (root && root.document) root.DDU_REFERENCE_DATA = data;
})(typeof globalThis === 'undefined' ? this : globalThis, function buildReferenceData() {
  const distributionRoutes = Object.freeze([
    'BANTAR KEMANG DURIAN RAYA',
    'CIHELET-PAKUAN',
    'CIAPUS',
    'SUKARAJA CIMAPAR',
    'TAJUR-CIAWI',
    'CIBEDUK-MADANG',
    'CIAWI-PUNCAK',
    'CIMANGU',
    'GUNUNG BATU SITU GEDE',
    'PANGERAN ASOGIRI POMAD',
    'BANTARKEMANG-BMC',
    'BANTAR KEMANNG-KATULAMPA',
    'KERADENAN',
    'Kampus 1',
    'Kampus 2',
    'Kampus 3',
    'DDU',
    'Lainnya'
  ]);
  const distributionRouteAliases = Object.freeze({
    'BANTAR KRMANNG-KATULAMPA': 'BANTAR KEMANNG-KATULAMPA'
  });
  const placementTypes = Object.freeze(['Kotak Amal', 'Tabung Infak', 'Kotak & Tabung', 'Mitra Proposal / Kerja Sama', 'Calon Mitra', 'Donatur / Calon Donatur', 'Mitra Media / Sponsor', 'Tidak ada']);
  const donorStatuses = Object.freeze(['aktif', 'nonaktif']);
  const donorTypes = Object.freeze(['Muzaki Individu', 'Muzaki Badan / Perusahaan', 'Donatur', 'Calon Donatur', 'Munfik (Pemberi Infak)', 'Mushaddiq (Pemberi Sedekah)', 'Wakif', 'Mitra', 'Mitra UMKM / Titik Kotak', 'Perusahaan / CSR', 'Masjid / Majelis Taklim', 'Pesantren / Lembaga Pendidikan', 'Komunitas / Organisasi', 'Ustadz / Ustadzah', 'Relawan', 'Penerima Manfaat / Mustahik', 'Kontak Lainnya']);
  const donationFrequencies = Object.freeze(['Belum rutin', 'Mingguan', 'Bulanan', 'Tahunan / Event', 'Insidental', 'Satu kali', 'Tidak berlaku']);
  const sourceOrigins = Object.freeze(['Yayasan', 'DDU', 'Kampus 1', 'Kampus 2', 'Kampus 3', 'Lainnya']);
  const educationLevels = Object.freeze(['MTs', 'MA', 'SMP', 'SMA']);
  const schoolClasses = Object.freeze(educationLevels.flatMap(level => {
    const grades = ['MTs', 'SMP'].includes(level) ? [7, 8, 9] : [10, 11, 12];
    return grades.flatMap(grade => ['A', 'B', 'C', 'D'].map(section => `${level} ${grade}${section}`));
  }));
  const referenceOptions = Object.freeze({
    distribution_route: distributionRoutes,
    placement_type: placementTypes,
    donor_status: donorStatuses,
    donor_type: donorTypes,
    donation_frequency: donationFrequencies,
    source_origin: sourceOrigins,
    education_level: educationLevels,
    school_class: schoolClasses
  });
  const referenceTypeLabels = Object.freeze({
    distribution_route: 'Jalur Distribusi (JD)',
    placement_type: 'Jenis Penitipan',
    donor_status: 'Status Donatur/Mitra',
    donor_type: 'Jenis Kontak',
    donation_frequency: 'Pola/Frekuensi Donasi',
    source_origin: 'Asal Unit/Sumber',
    education_level: 'Jenjang Pendidikan',
    school_class: 'Kelas/Rombel'
  });
  return Object.freeze({ distributionRoutes, distributionRouteAliases, placementTypes, donorStatuses, donorTypes, donationFrequencies, sourceOrigins, educationLevels, schoolClasses, referenceOptions, referenceTypeLabels });
});
