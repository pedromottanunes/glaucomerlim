self.addEventListener('install', function(e) {
  console.log('Service Worker instalado');
});

self.addEventListener('fetch', function(e) {
  // Padrão: deixar o navegador lidar com as requisições
});
