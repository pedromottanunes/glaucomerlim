const { google } = require('googleapis');

// Configurações das planilhas
const SPREADSHEET_ID = '1bLG8LOmqUTvlKQ0czHSmRYFU2DVUkMVYVaLNWckv7oY';
const FEEDBACKS_SHEET_NAME = 'Feedbacks_Clientes';

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

// Função para adicionar feedback à planilha
async function addFeedbackToSheet(feedbackData) {
  try {
    const auth = await getGoogleSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Preparar os dados para inserção
    const values = [[
      feedbackData.clientId || '',
      feedbackData.clientName || '',
      feedbackData.feedbackDate || new Date().toISOString(),
      feedbackData.feedbackSummary || '',
      feedbackData.feedbackComplete || '',
      feedbackData.source || 'WhatsApp_IA'
    ]];
    
    const request = {
      spreadsheetId: SPREADSHEET_ID,
      range: `${FEEDBACKS_SHEET_NAME}!A:F`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: values
      }
    };
    
    const response = await sheets.spreadsheets.values.append(request);
    return response.data;
  } catch (error) {
    console.error('Erro ao adicionar feedback:', error);
    throw error;
  }
}

// Função para buscar feedbacks de um cliente específico
async function getFeedbacksByClient(clientId) {
  try {
    const auth = await getGoogleSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${FEEDBACKS_SHEET_NAME}!A:F`
    });
    
    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return []; // Sem dados ou apenas cabeçalho
    }
    
    // Filtrar dados pelo clientId
    const clientFeedbacks = rows.slice(1)
      .filter(row => row[0] === clientId)
      .map(row => ({
        clientId: row[0],
        clientName: row[1],
        feedbackDate: row[2],
        feedbackSummary: row[3],
        feedbackComplete: row[4],
        source: row[5]
      }))
      .sort((a, b) => new Date(b.feedbackDate) - new Date(a.feedbackDate)); // Mais recentes primeiro
    
    return clientFeedbacks;
  } catch (error) {
    console.error('Erro ao buscar feedbacks:', error);
    throw error;
  }
}

exports.handler = async function(event, context) {
  // Configurar CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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

    // Se for uma requisição POST (dados vindos do agente de IA)
    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body);
      
      console.log('Feedback recebido do agente de IA:', data);
      
      // Adicionar feedback à planilha
      await addFeedbackToSheet(data);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: "Feedback salvo com sucesso!",
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // Se for uma requisição GET (frontend buscando feedbacks)
    if (event.httpMethod === 'GET') {
      const clientId = event.queryStringParameters?.clientId;
      
      if (!clientId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Parâmetro clientId é obrigatório' 
          })
        };
      }
      
      // Buscar feedbacks do cliente específico
      const feedbacks = await getFeedbacksByClient(clientId);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: feedbacks,
          message: "Feedbacks obtidos com sucesso!"
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

