// Configurações das planilhas
//const SPREADSHEET_ID = '1bLG8LOmqUTvlKQ0czHSmRYFU2DVUkMVYVaLNWckv7oY';
//const METRICS_SHEET_NAME = 'Métricas_Trafego_Pago';
//const FEEDBACKS_SHEET_NAME = 'Feedbacks_Clientes';

const { google } = require('googleapis');

exports.handler = async function(event, context) {
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

    const { clientId, startDate, endDate } = event.queryStringParameters || {};
    if (!clientId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "clientId obrigatório" }) };
    }


    // Lê todas as linhas da aba Métricas_Trafego_Pago
    const spreadsheetId = '1bLG8LOmqUTvlKQ0czHSmRYFU2DVUkMVYVaLNWckv7oY';
    const range = 'Métricas_Trafego_Pago!A:L';
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });

    const rows = res.data.values || [];
    const header = rows[0];
    let data = rows.slice(1)
      .map(r => {
        let obj = {};
        header.forEach((col, idx) => { obj[col] = r[idx] || ''; });
        return obj;
      })
      .filter(row => row.ID_Cliente === clientId);

    // Filtra por data se informado
    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      data = data.filter(row => {
        const dt = new Date(row.Data_Referencia);
        return dt >= s && dt <= e;
      });
    }

    // Se não houver dados, retorna vazio
    if (!data.length) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, summary: {}, campaigns: [] })
      };
    }

    // Agrupa por campanha
    const campanhas = {};
    for (const row of data) {
      const campanha = row.Campanha || 'SEM NOME';
      if (!campanhas[campanha]) campanhas[campanha] = [];
      campanhas[campanha].push(row);
    }

    // Soma geral (resumo)
    const resumo = {
      impressões: 0, cliques: 0, conversões: 0, custo: 0,
      ctr: 0, taxaConversao: 0, custoPorConversao: 0
    };
    let nCampanhas = 0;

    // Calcula resumo e prepara retorno por campanha
    const campanhasArr = Object.entries(campanhas).map(([nome, rows]) => {
      let imp = 0, clk = 0, conv = 0, cst = 0;
      rows.forEach(r => {
        imp += Number(r.Impressoes || 0);
        clk += Number(r.Cliques || 0);
        conv += Number(r.Conversoes || 0);
        cst += Number(r.Custo || 0);
      });
      nCampanhas++;
      resumo.impressões += imp;
      resumo.cliques += clk;
      resumo.conversões += conv;
      resumo.custo += cst;
      return {
        campanha: nome,
        periodo: `${rows[0].Data_Referencia} ... ${rows[rows.length-1].Data_Referencia}`,
        impressoes: imp,
        cliques: clk,
        conversoes: conv,
        custo: cst,
        ctr: clk && imp ? ((clk/imp)*100).toFixed(2) : '0',
        taxaConversao: conv && clk ? ((conv/clk)*100).toFixed(2) : '0',
        custoPorConversao: conv ? (cst/conv).toFixed(2) : '0'
      };
    });
    resumo.ctr = resumo.cliques && resumo.impressões ? ((resumo.cliques/resumo.impressões)*100).toFixed(2) : '0';
    resumo.taxaConversao = resumo.conversões && resumo.cliques ? ((resumo.conversões/resumo.cliques)*100).toFixed(2) : '0';
    resumo.custoPorConversao = resumo.conversões ? (resumo.custo/resumo.conversões).toFixed(2) : '0';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        summary: resumo,
        campaigns: campanhasArr
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro interno do servidor', message: error.message })
    };
  }
};
