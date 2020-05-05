import {t} from 'app/locale';

export const PERFORMANCE_TERMS: Record<string, string> = {
  apdex: t(
    'Apdex is a ratio of satisfactory response times to unsatisfactory response times.'
  ),
  rpm: t('Throughput is the number of recorded transactions per minute (tpm).'),
};
