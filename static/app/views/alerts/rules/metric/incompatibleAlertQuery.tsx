import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type EventView from 'sentry/utils/discover/eventView';
import type {Aggregation} from 'sentry/utils/discover/fields';
import {AGGREGATIONS, explodeFieldString} from 'sentry/utils/discover/fields';
import {
  errorFieldConfig,
  transactionFieldConfig,
} from 'sentry/views/alerts/rules/metric/constants';
import {getQueryDatasource} from 'sentry/views/alerts/utils';

/**
 * Discover query supports more features than alert rules
 * To create an alert rule from a discover query, some parameters need to be adjusted
 */
type IncompatibleQueryProperties = {
  /**
   * Must have zero or one environments
   */
  hasEnvironmentError: boolean;
  /**
   * event.type must be error or transaction
   */
  hasEventTypeError: boolean;
  /**
   * Must have exactly one project selected and not -1 (all projects)
   */
  hasProjectError: boolean;
  hasYAxisError: boolean;
};

function incompatibleYAxis(eventView: EventView): boolean {
  const column = explodeFieldString(eventView.getYAxis());
  if (
    column.kind === 'field' ||
    column.kind === 'equation' ||
    column.kind === 'calculatedField'
  ) {
    return true;
  }

  const eventTypeMatch = eventView.query.match(/event\.type:(transaction|error)/);
  if (!eventTypeMatch) {
    return false;
  }

  const dataset = eventTypeMatch[1];
  const yAxisConfig = dataset === 'error' ? errorFieldConfig : transactionFieldConfig;

  const invalidFunction = !yAxisConfig.aggregations.includes(column.function[0]);
  // Allow empty parameters, allow all numeric parameters - eg. apdex(300)
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const aggregation: Aggregation | undefined = AGGREGATIONS[column.function[0]];
  if (!aggregation) {
    return false;
  }

  const isNumericParameter = aggregation.parameters.some(
    param => param.kind === 'value' && param.dataType === 'number'
  );
  // There are other measurements possible, but for the time being, only allow alerting
  // on the predefined set of measurements for alerts.
  const allowedParameters = [
    '',
    ...yAxisConfig.fields,
    ...(yAxisConfig.measurementKeys ?? []),
  ];
  const invalidParameter =
    !isNumericParameter && !allowedParameters.includes(column.function[1]);

  return invalidFunction || invalidParameter;
}

export function checkMetricAlertCompatiablity(
  eventView: EventView
): IncompatibleQueryProperties {
  // Must have exactly one project selected and not -1 (all projects)
  const hasProjectError = eventView.project.length !== 1 || eventView.project[0] === -1;
  // Must have one or zero environments
  const hasEnvironmentError = eventView.environment.length > 1;
  // Must have event.type of error or transaction
  const hasEventTypeError = getQueryDatasource(eventView.query) === null;
  // yAxis must be a function and enabled on alerts
  const hasYAxisError = incompatibleYAxis(eventView);
  return {
    hasProjectError,
    hasEnvironmentError,
    hasEventTypeError,
    hasYAxisError,
  };
}

interface IncompatibleAlertQueryProps {
  eventView: EventView;
}

/**
 * Displays messages to the user on what needs to change in their query
 */
export function IncompatibleAlertQuery(props: IncompatibleAlertQueryProps) {
  const [isOpen, setIsOpen] = useState(true);
  const incompatibleQuery = checkMetricAlertCompatiablity(props.eventView);
  const totalErrors = Object.values(incompatibleQuery).filter(val => val).length;

  if (!totalErrors || !isOpen) {
    return null;
  }

  return (
    <Alert.Container>
      <StyledAlert
        type="info"
        showIcon
        trailingItems={
          <Button
            icon={<IconClose size="sm" />}
            aria-label={t('Close')}
            size="zero"
            onClick={() => setIsOpen(false)}
            borderless
          />
        }
      >
        {t('The following problems occurred while creating your alert:')}
        <StyledUnorderedList>
          {incompatibleQuery.hasProjectError && <li>{t('No project was selected')}</li>}
          {incompatibleQuery.hasEnvironmentError && (
            <li>{t('Too many environments were selected')}</li>
          )}
          {incompatibleQuery.hasEventTypeError && (
            <li>
              {tct(
                "An event type wasn't selected. [defaultSetting] has been set as the default",
                {
                  defaultSetting: <StyledCode>event.type:error</StyledCode>,
                }
              )}
            </li>
          )}
          {incompatibleQuery.hasYAxisError && (
            <li>
              {tct('An alert can’t use the metric [yAxis] just yet.', {
                yAxis: <StyledCode>{props.eventView.getYAxis()}</StyledCode>,
              })}
            </li>
          )}
        </StyledUnorderedList>
      </StyledAlert>
    </Alert.Container>
  );
}

const StyledAlert = styled(Alert)`
  color: ${p => p.theme.textColor};
`;

const StyledUnorderedList = styled('ul')`
  margin-bottom: 0;
`;

const StyledCode = styled('code')`
  background-color: transparent;
  padding: 0;
`;
