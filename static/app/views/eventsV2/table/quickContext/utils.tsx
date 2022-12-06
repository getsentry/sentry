import {browserHistory} from 'react-router';
import {Location} from 'history';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView, {EventData} from 'sentry/utils/discover/eventView';
import toArray from 'sentry/utils/toArray';

import {NoContextWrapper} from './styles';

export const fiveMinutesInMs = 5 * 60 * 1000;

export enum ContextType {
  ISSUE = 'issue',
  RELEASE = 'release',
  EVENT = 'event',
}

export type BaseContextProps = {
  dataRow: EventData;
  organization: Organization;
};

export const addFieldAsColumn = (
  fieldName: string,
  organization: Organization,
  location?: Location,
  eventView?: EventView
) => {
  trackAdvancedAnalyticsEvent('discover_v2.quick_context_add_column', {
    organization,
    column: fieldName,
  });

  const oldField = location?.query.field || eventView?.fields.map(field => field.field);
  const newField = toArray(oldField).concat(fieldName);
  browserHistory.push({
    ...location,
    query: {
      ...location?.query,
      field: newField,
    },
  });
};

type NoContextProps = {
  isLoading: boolean;
};

export function NoContext({isLoading}: NoContextProps) {
  return isLoading ? (
    <NoContextWrapper>
      <LoadingIndicator
        data-test-id="quick-context-loading-indicator"
        hideMessage
        size={32}
      />
    </NoContextWrapper>
  ) : (
    <NoContextWrapper>{t('Failed to load context for column.')}</NoContextWrapper>
  );
}
