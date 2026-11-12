import {skipToken} from '@tanstack/react-query';

import type {AlertPreviewResponse} from 'sentry/types/workflowEngine/automations';
import type {
  DataCondition,
  DataConditionGroup,
} from 'sentry/types/workflowEngine/dataConditions';
import {apiOptions} from 'sentry/utils/api/apiOptions';

interface AlertPreviewDataConditionGroup {
  conditions: Array<Pick<DataCondition, 'comparison' | 'type'>>;
  logicType: DataConditionGroup['logicType'];
}

export type AlertPreviewRequest = {
  actionFilters: AlertPreviewDataConditionGroup[];
  config: {frequency: number};
  projectIds: number[];
  triggers: AlertPreviewDataConditionGroup;
};

export function alertPreviewQueryOptions({
  organizationSlug,
  request,
}: {
  organizationSlug: string;
  request: AlertPreviewRequest | null;
}) {
  return apiOptions.as<AlertPreviewResponse[]>()(
    '/organizations/$organizationIdOrSlug/workflows/preview/',
    {
      path: request ? {organizationIdOrSlug: organizationSlug} : skipToken,
      method: 'POST',
      data: request ?? undefined,
      staleTime: 0,
    }
  );
}
