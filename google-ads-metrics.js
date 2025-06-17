exports.handler = async function(event, context) {
  // Por enquanto, vamos apenas retornar uma mensagem de sucesso.
  // No futuro, aqui você processará os dados recebidos do Make
  // e os disponibilizará para o frontend.
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Netlify Function para Google Ads ativada!" })
  };
};
