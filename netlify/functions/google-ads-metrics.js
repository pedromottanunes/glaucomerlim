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

    console.log(`Dados encontrados para cliente ${clientId}:`, data.length);

    // Função para converter data para formato YYYY-MM-DD
    function formatDateToISO(dateStr) {
      if (!dateStr) return '';
      
      // Se já está no formato YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        return dateStr.substring(0, 10);
      }
      
      // Se está no formato DD/MM/YYYY
      if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr)) {
        const parts = dateStr.split('/');
        if (parts.length >= 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          return `${year}-${month}-${day}`;
        }
      }
      
      // Se está no formato DD-MM-YYYY
      if (/^\d{1,2}-\d{1,2}-\d{4}/.test(dateStr)) {
        const parts = dateStr.split('-');
        if (parts.length >= 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          return `${year}-${month}-${day}`;
        }
      }
      
      // Tenta converter usando Date (para outros formatos)
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } catch (e) {
        console.log('Erro ao converter data:', dateStr, e);
      }
      
      return '';
    }

    // Verifica se há dados com Data_Referencia preenchida
    const dataComData = data.filter(row => row.Data_Referencia && row.Data_Referencia.trim() !== '');
    const temDatasValidas = dataComData.length > 0;

    console.log(`Dados com Data_Referencia preenchida: ${dataComData.length} de ${data.length}`);

    // Filtra por data APENAS se:
    // 1. startDate e endDate foram informados
    // 2. E há pelo menos alguns dados com Data_Referencia preenchida
    if (startDate && endDate && temDatasValidas) {
      console.log('Aplicando filtro de data:', { startDate, endDate });
      
      data = data.filter(row => {
        // Se não tem Data_Referencia, inclui no resultado (não filtra por data)
        if (!row.Data_Referencia || row.Data_Referencia.trim() === '') {
          console.log('Linha sem data - incluindo:', row.ID_Cliente, row.Campanha);
          return true;
        }
        
        const dataRowISO = formatDateToISO(row.Data_Referencia);
        console.log('Data original:', row.Data_Referencia, 'Convertida:', dataRowISO);
        
        if (!dataRowISO) {
          console.log('Não foi possível converter a data - incluindo:', row.Data_Referencia);
          return true; // Inclui se não conseguir converter
        }
        
        const isInRange = dataRowISO >= startDate && dataRowISO <= endDate;
        console.log('Data no período?', isInRange, { dataRowISO, startDate, endDate });
        
        return isInRange;
      });
      
      console.log('Dados após filtro de data:', data.length, 'registros');
    } else {
      if (startDate && endDate) {
        console.log('Filtro de data solicitado, mas não há datas válidas na planilha - retornando todos os dados');
      } else {
        console.log('Sem filtros de data - retornando todos os dados do cliente');
      }
    }

    // Se não houver dados, retorna vazio
    if (!data.length) {
      console.log('Nenhum dado encontrado para o cliente/período');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          summary: {}, 
          campaigns: [],
          debug: {
            clientId,
            startDate,
            endDate,
            totalRowsBeforeFilter: rows.length - 1,
            rowsAfterClientFilter: data.length,
            temDatasValidas,
            message: 'Nenhum dado encontrado para este cliente/período'
          }
        })
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
      
      // Para o período, usa as datas disponíveis ou uma mensagem padrão
      let periodo = 'Período não especificado';
      const datasValidas = rows.filter(r => r.Data_Referencia && r.Data_Referencia.trim() !== '');
      if (datasValidas.length > 0) {
        const primeiraData = formatDateToISO(datasValidas[0].Data_Referencia) || datasValidas[0].Data_Referencia;
        const ultimaData = formatDateToISO(datasValidas[datasValidas.length-1].Data_Referencia) || datasValidas[datasValidas.length-1].Data_Referencia;
        periodo = `${primeiraData} ... ${ultimaData}`;
      }
      
      return {
        campanha: nome,
        periodo: periodo,
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

    console.log('Resumo calculado:', resumo);
    console.log('Campanhas encontradas:', campanhasArr.length);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        summary: resumo,
        campaigns: campanhasArr,
        debug: {
          clientId,
          startDate,
          endDate,
          totalRowsFound: data.length,
          campaignsFound: campanhasArr.length,
          temDatasValidas,
          message: `Dados encontrados: ${data.length} registros, ${campanhasArr.length} campanhas`
        }
      })
    };

  } catch (error) {
    console.error('Erro na função:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erro interno do servidor', 
        message: error.message,
        stack: error.stack 
      })
    };
  }
};

