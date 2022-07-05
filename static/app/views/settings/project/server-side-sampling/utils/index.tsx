import {t} from 'sentry/locale';
import {SamplingInnerName} from 'sentry/types/sampling';

// TODO: Update this link as soon as we have one for sampling
export const SERVER_SIDE_SAMPLING_DOC_LINK =
  'https://docs.sentry.io/product/data-management-settings/filtering/';

export function getInnerNameLabel(name: SamplingInnerName | string) {
  switch (name) {
    case SamplingInnerName.TRACE_ENVIRONMENT:
      return t('Environment');
    case SamplingInnerName.TRACE_RELEASE:
      return t('Release');
    case SamplingInnerName.TRACE_USER_ID:
      return t('User Id');
    case SamplingInnerName.TRACE_USER_SEGMENT:
      return t('User Segment');
    case SamplingInnerName.TRACE_TRANSACTION:
      return t('Transaction');
    default:
      return '';
  }
}

export const quantityField = 'sum(quantity)';
