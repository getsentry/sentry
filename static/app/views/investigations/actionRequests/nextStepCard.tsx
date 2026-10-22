import {t} from 'sentry/locale';
import {ActionRequestCard} from 'sentry/views/investigations/actionRequests/actionRequestCard';
import type {InvestigationDetail} from 'sentry/views/investigations/types';

export function NextStepCard({investigation}: {investigation: InvestigationDetail}) {
  return (
    <ActionRequestCard
      investigation={investigation}
      select={actionRequest => actionRequest.primary}
      heading={t('Recommended action')}
    />
  );
}
