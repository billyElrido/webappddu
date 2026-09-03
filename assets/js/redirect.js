(function () {
  var localHosts = ['127.0.0.1', 'localhost'];
  if (localHosts.includes(window.location.hostname) && window.location.port === '5500') {
    window.location.replace('http://127.0.0.1:8000/');
  }
})();
