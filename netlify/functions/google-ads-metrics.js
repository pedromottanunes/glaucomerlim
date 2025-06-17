exports.handler = async function(event, context) {
  // Configurar CORS para permitir requisições do frontend
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Responder a requisições OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS' ) {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Se for uma requisição POST (dados vindos do Make)
    if (event.httpMethod === 'POST' ) {
      const data = JSON.parse(event.body);
      
      // Aqui você pode processar os dados recebidos do Make
      console.log('Dados recebidos do Make:', data);
      
      // Por enquanto, apenas retornamos uma confirmação
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: "Dados do Google Ads recebidos com sucesso!",
          receivedData: data,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // Se for uma requisição GET (frontend buscando dados)
    if (event.httpMethod === 'GET' ) {
      // Por enquanto, retornamos dados de exemplo
      // No futuro, aqui você buscará os dados reais armazenados
      const mockData = {
        impressions: 15420,
        clicks: 892,
        conversions: 47,
        cost: 1250.75,
        ctr: 5.78,
        conversionRate: 5.27,
        costPerConversion: 26.61,
        lastUpdated: new Date().toISOString()
      };
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: mockData,
          message: "Métricas do Google Ads obtidas com sucesso!"
        })
      };
    }
    
    // Método não suportado
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método não permitido' })
    };
    
  } catch (error) {
    console.error('Erro na função:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erro interno do servidor',
        message: error.message 
      })
    };
  }
};
