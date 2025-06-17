self.addEventListener('install', function(e) {
  console.log('Service Worker instalado');
});

self.addEventListener('fetch', function(e) {
  // padrão: deixar o navegador lidar com as requisições
});
