import {parseStatsPeriod} from 'sentry/components/organizations/pageFilters/parse';

/**
 * This parses our period shorthand strings (e.g. <int><unit>)
 * and converts it into hours
 */
export function parsePeriodToHours(str: string): number {
  const result = parseStatsPeriod(str);

  if (!result) {
    return -1;
  }

  const {period, periodLength} = result;

  const periodNumber = parseInt(period!, 10);

  switch (periodLength) {
    case 's':
      return periodNumber / (60 * 60);
    case 'm':
      return periodNumber / 60;
    case 'h':
      return periodNumber;
    case 'd':
      return periodNumber * 24;
    case 'w':
      return periodNumber * 24 * 7;
    default:
      return -1;
  }
}
