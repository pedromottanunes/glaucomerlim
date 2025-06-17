const { google } = require('googleapis');

// Configurações das planilhas
const SPREADSHEET_ID = '1bLG8LOmqUTvlKQ0czHSmRYFU2DVUkMVYVaLNWckv7oY';
const METRICS_SHEET_NAME = 'Métricas_Trafego_Pago';

// Função para autenticar com Google Sheets
async function getGoogleSheetsAuth() {
  try {
    const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    return auth;
  } catch (error) {
    console.error('Erro na autenticação:', error);
    throw new Error('Falha na autenticação com Google Sheets');
  }
}

// Função para buscar lista de clientes únicos
async function getClientsList() {
  try {
    const auth = await getGoogleSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${METRICS_SHEET_NAME}!A:B`
    });
    
    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return []; // Sem dados ou apenas cabeçalho
    }
    
    // Extrair clientes únicos (ID e Nome)
    const clientsMap = new Map();
    
    rows.slice(1).forEach(row => {
      const clientId = row[0];
      const clientName = row[1];
      
      if (clientId && clientName && !clientsMap.has(clientId)) {
        clientsMap.set(clientId, {
          id: clientId,
          name: clientName
        });
      }
    });
    
    // Converter Map para Array e ordenar por nome
    const clientsList = Array.from(clientsMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return clientsList;
  } catch (error) {
    console.error('Erro ao buscar lista de clientes:', error);
    throw error;
  }
}

exports.handler = async function(event, context) {
  // Configurar CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Responder a requisições OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Verificar se a variável de ambiente está configurada
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Variável de ambiente GOOGLE_SERVICE_ACCOUNT_KEY não configurada' 
        })
      };
    }

    // Apenas requisições GET são suportadas
    if (event.httpMethod === 'GET') {
      const clients = await getClientsList();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: clients,
          message: "Lista de clientes obtida com sucesso!"
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

