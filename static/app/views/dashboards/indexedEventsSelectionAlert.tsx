import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {parseSearch} from 'sentry/components/searchSyntax/parser';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {parseFunction} from 'sentry/utils/discover/fields';
import {
  MEPConsumer,
  MEPState,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import useOrganization from 'sentry/utils/useOrganization';

import {DashboardsMEPConsumer} from './widgetCard/dashboardsMEPContext';
import {type Widget, WidgetType} from './types';

type SearchFilterKey = {key?: {value: string}};

interface IndexedEventsSelectionAlertProps {
  widget: Widget;
}

const ERROR_FIELDS = [
  'error.handled',
  'error.unhandled',
  'error.mechanism',
  'error.type',
  'error.value',
];

export function IndexedEventsSelectionAlert({widget}: IndexedEventsSelectionAlertProps) {
  const organization = useOrganization();

  if (organization.features.includes('performance-mep-bannerless-ui')) {
    return null;
  }

  const widgetContainsErrorFields = widget.queries.some(
    ({columns, aggregates, conditions}) =>
      ERROR_FIELDS.some(
        errorField =>
          columns.includes(errorField) ||
          aggregates.some(aggregate =>
            parseFunction(aggregate)?.arguments.includes(errorField)
          ) ||
          parseSearch(conditions)?.some(
            filter => (filter as SearchFilterKey).key?.value === errorField
          )
      )
  );

  return (
    <MEPConsumer>
      {metricSettingContext => {
        return (
          <DashboardsMEPConsumer>
            {({isMetricsData}) => {
              if (
                isMetricsData === false &&
                widget.widgetType === WidgetType.DISCOVER &&
                metricSettingContext &&
                metricSettingContext.metricSettingState !== MEPState.TRANSACTIONS_ONLY
              ) {
                if (!widgetContainsErrorFields) {
                  return (
                    <StoredDataAlert type="info" showIcon>
                      {tct(
                        "Your selection is only applicable to [indexedData: indexed event data]. We've automatically adjusted your results.",
                        {
                          indexedData: (
                            <ExternalLink href="https://docs.sentry.io/product/dashboards/widget-builder/#transactions" />
                          ),
                        }
                      )}
                    </StoredDataAlert>
                  );
                }
              }
              return null;
            }}
          </DashboardsMEPConsumer>
        );
      }}
    </MEPConsumer>
  );
}

const StoredDataAlert = styled(Alert)`
  margin-top: ${space(1)};
`;
