import type { ExchangeRateData } from '../types';

const ECB_BASE_URL = '/api/ecb';

// Parse YYYY-MM-DD as local date to avoid timezone issues
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Format date as YYYY-MM-DD in local time
function formatDateForApi(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface EcbObservation {
  date: string;
  value: number;
}

async function fetchEcbData(
  startDate: string,
  endDate: string
): Promise<EcbObservation[]> {
  const url = `${ECB_BASE_URL}?startPeriod=${startDate}&endPeriod=${endDate}&format=jsondata`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ECB API error: ${response.statusText}`);
  }

  const data = await response.json();

  // Parse ECB JSON response format
  // The data structure is: dataSets[0].series["0:0:0:0:0"].observations
  // with dimensions containing the dates
  const observations: EcbObservation[] = [];

  try {
    const series = data.dataSets?.[0]?.series?.['0:0:0:0:0'];
    const timePeriods = data.structure?.dimensions?.observation?.[0]?.values;

    if (series && timePeriods) {
      for (const [idx, obs] of Object.entries(series.observations)) {
        const periodIdx = parseInt(idx);
        const period = timePeriods[periodIdx];
        if (period && obs) {
          observations.push({
            date: period.id, // Format: YYYY-MM-DD
            value: (obs as number[])[0],
          });
        }
      }
    }
  } catch (e) {
    console.error('Error parsing ECB data:', e);
    throw new Error('Failed to parse ECB response');
  }

  return observations.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getLatestAvailableDateEcb(): Promise<Date> {
  // Fetch recent data to find the latest available date
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const observations = await fetchEcbData(
    formatDateForApi(startDate),
    formatDateForApi(endDate)
  );

  if (observations.length === 0) {
    throw new Error('No ECB data available');
  }

  // Return the most recent date
  const latestObs = observations[observations.length - 1];
  return parseLocalDate(latestObs.date);
}

export async function getEurUsdData(
  daysBack: number = 120,
  asOfDate?: Date
): Promise<ExchangeRateData> {
  const endDate = asOfDate || new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - daysBack - 30);

  // Also fetch prior year data
  const priorYearEnd = new Date(endDate);
  priorYearEnd.setFullYear(priorYearEnd.getFullYear() - 1);
  const priorYearStart = new Date(priorYearEnd);
  priorYearStart.setDate(priorYearStart.getDate() - 14);

  const [currentData, priorYearData] = await Promise.all([
    fetchEcbData(formatDateForApi(startDate), formatDateForApi(endDate)),
    fetchEcbData(formatDateForApi(priorYearStart), formatDateForApi(priorYearEnd)),
  ]);

  // Transform to standard format
  const observations = currentData
    .map((obs) => ({
      date: parseLocalDate(obs.date),
      value: obs.value,
    }))
    .filter((obs) => obs.date <= endDate);

  const priorYearObservations = priorYearData
    .map((obs) => ({
      date: parseLocalDate(obs.date),
      value: obs.value,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const currentValue = observations[observations.length - 1]?.value || 0;
  const priorYearValue = priorYearObservations[0]?.value || 0;
  const yoyChange = currentValue - priorYearValue;

  const latestDate = observations[observations.length - 1]?.date || new Date();

  return {
    current: currentValue,
    priorYear: priorYearValue,
    yoyChange,
    dataAsOf: latestDate.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    }),
    observations,
  };
}
