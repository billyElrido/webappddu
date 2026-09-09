'use strict';

(() => {
  const mapsInput = document.getElementById('donorMaps');
  const donorForm = document.getElementById('donorForm');
  if (!mapsInput || !donorForm) return;

  mapsInput.type = 'text';
  mapsInput.inputMode = 'url';
  mapsInput.required = false;
  mapsInput.placeholder = 'Tempel tautan atau titikkan lokasi';

  const locationButton = document.createElement('button');
  locationButton.type = 'button';
  locationButton.className = 'secondary location-button';
  locationButton.textContent = '⌖ Titikkan lokasi saat ini';
  const locationStatus = document.createElement('small');
  locationStatus.className = 'field-help';
  locationStatus.textContent = 'Opsional. Dapat dikosongkan dan dilengkapi kemudian.';
  mapsInput.after(locationButton, locationStatus);

  locationButton.addEventListener('click', () => {
    if (!navigator.geolocation) {
      locationStatus.textContent = 'Perangkat atau browser tidak mendukung penitikan lokasi.';
      return;
    }
    locationButton.disabled = true;
    locationStatus.textContent = 'Mengambil titik lokasi GPS…';
    navigator.geolocation.getCurrentPosition(position => {
      const latitude = position.coords.latitude.toFixed(7);
      const longitude = position.coords.longitude.toFixed(7);
      mapsInput.value = `https://www.google.com/maps?q=${latitude},${longitude}`;
      locationStatus.textContent = `Lokasi berhasil dititikkan, akurasi ±${Math.round(position.coords.accuracy)} meter.`;
      locationButton.disabled = false;
    }, error => {
      locationStatus.textContent = error.code === 1
        ? 'Izin lokasi ditolak. Isi manual atau biarkan kosong.'
        : 'Lokasi belum ditemukan. Coba kembali atau isi manual.';
      locationButton.disabled = false;
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });

  donorForm.addEventListener('submit', () => {
    const value = mapsInput.value.trim();
    if (value === '-') mapsInput.value = '';
  }, true);

  const originalLoadDonors = loadDonors;
  loadDonors = async () => {
    await originalLoadDonors();
    try {
      const data = await api('/api/donors?' + rangeQuery());
      const rows = document.querySelectorAll('#donorRows tr');
      const table = document.getElementById('donorRows')?.closest('table');
      const locationIndex = [...(table?.querySelectorAll('thead th') || [])]
        .findIndex(header => header.textContent.trim() === 'Lokasi');
      data.items.forEach((donor, index) => {
        const locationCell = locationIndex >= 0 ? rows[index]?.children[locationIndex] : null;
        if (!locationCell || donor.division !== currentUser.division) return;
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'donor-map-edit';
        editButton.textContent = donor.maps_url ? 'Ubah lokasi' : 'Lengkapi lokasi';
        editButton.onclick = async () => {
          const value = prompt('Tempel tautan Google Maps. Kosongkan untuk menghapus lokasi:', donor.maps_url || '');
          if (value === null) return;
          try {
            await api('/api/donors/maps', { method: 'PUT', body: JSON.stringify({ id: donor.id, maps_url: value.trim() === '-' ? '' : value.trim() }) });
            await loadDonors();
            toast('Lokasi Google Maps berhasil diperbarui.');
          } catch (error) { toast(error.message); }
        };
        locationCell.append(editButton);
      });
    } catch (error) { toast(error.message); }
  };
})();
