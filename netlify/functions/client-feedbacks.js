const { google } = require('googleapis');

exports.handler = async function(event, context) {
  // CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.JWT(
      serviceAccount.client_email,
      null,
      serviceAccount.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const sheets = google.sheets({ version: 'v4', auth });

    const { clientId } = event.queryStringParameters;
    if (!clientId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "clientId obrigatório" }) };
    }

    
    // Lê todas as linhas da aba Feedbacks_Clientes
    const spreadsheetId = '1bLG8LOmqUTvlKQ0czHSmRYFU2DVUkMVYVaLNWckv7oY';
    const range = 'Feedbacks_Clientes!A:F';
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });

    const rows = res.data.values || [];
    const header = rows[0];
    const data = rows.slice(1)
      .filter(r => r[0] === clientId)
      .map(r => {
        let obj = {};
        header.forEach((col, idx) => { obj[col] = r[idx] || ''; });
        return obj;
      })
      // Ordena por Data_Feedback DESC
      .sort((a, b) => new Date(b.Data_Feedback) - new Date(a.Data_Feedback));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro interno do servidor', message: error.message })
    };
  }
};
