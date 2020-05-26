import {t} from 'app/locale';

export const PERFORMANCE_TERMS: Record<string, string> = {
  apdex: t(
    'Apdex is the ratio of both satisfactory and tolerable response times to all response times.'
  ),
  tpm: t('TPM is the number of recorded transaction events per minute.'),
  errorRate: t(
    'Error rate is the percentage of recorded transactions that had a known and unsuccessful status.'
  ),
};
