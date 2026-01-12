export default async function (context, req) {
  const startPeriod = req.query.startPeriod || '';
  const endPeriod = req.query.endPeriod || '';
  const format = req.query.format || 'jsondata';

  // ECB API for EUR/USD exchange rate
  const ecbUrl = `https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?startPeriod=${startPeriod}&endPeriod=${endPeriod}&format=${format}`;

  try {
    const response = await fetch(ecbUrl);
    const data = await response.text();

    context.res = {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
      body: data,
    };
  } catch (error) {
    context.res = {
      status: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
