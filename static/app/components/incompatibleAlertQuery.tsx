import {Fragment} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type EventView from 'sentry/utils/discover/eventView';
import {
  Aggregation,
  AGGREGATIONS,
  explodeFieldString,
} from 'sentry/utils/discover/fields';
import {
  errorFieldConfig,
  transactionFieldConfig,
} from 'sentry/views/alerts/rules/metric/constants';
import {getQueryDatasource} from 'sentry/views/alerts/utils';

/**
 * Discover query supports more features than alert rules
 * To create an alert rule from a discover query, some parameters need to be adjusted
 */
export type IncompatibleQueryProperties = {
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
  /**
   * Dismiss alert
   */
  onClose: () => void;
  orgSlug: string;
}

/**
 * Displays messages to the user on what needs to change in their query
 */
export function IncompatibleAlertQuery(props: IncompatibleAlertQueryProps) {
  const incompatibleQuery = checkMetricAlertCompatiablity(props.eventView);
  const totalErrors = Object.values(incompatibleQuery).filter(val => val).length;

  if (!totalErrors) {
    return null;
  }

  const eventTypeError = props.eventView.clone();
  eventTypeError.query += ' event.type:error';
  const eventTypeTransaction = props.eventView.clone();
  eventTypeTransaction.query += ' event.type:transaction';
  const eventTypeDefault = props.eventView.clone();
  eventTypeDefault.query += ' event.type:default';
  const eventTypeErrorDefault = props.eventView.clone();
  eventTypeErrorDefault.query += ' event.type:error or event.type:default';
  const pathname = `/organizations/${props.orgSlug}/discover/results/`;

  const eventTypeLinks = {
    error: (
      <Link
        to={{
          pathname,
          query: eventTypeError.generateQueryStringObject(),
        }}
      />
    ),
    default: (
      <Link
        to={{
          pathname,
          query: eventTypeDefault.generateQueryStringObject(),
        }}
      />
    ),
    transaction: (
      <Link
        to={{
          pathname,
          query: eventTypeTransaction.generateQueryStringObject(),
        }}
      />
    ),
    errorDefault: (
      <Link
        to={{
          pathname,
          query: eventTypeErrorDefault.generateQueryStringObject(),
        }}
      />
    ),
  };

  return (
    <StyledAlert
      type="warning"
      showIcon
      trailingItems={
        <Button
          icon={<IconClose size="sm" />}
          aria-label={t('Close')}
          size="zero"
          onClick={props.onClose}
          borderless
        />
      }
    >
      {totalErrors === 1 && (
        <Fragment>
          {incompatibleQuery.hasProjectError &&
            t('An alert can use data from only one Project. Select one and try again.')}
          {incompatibleQuery.hasEnvironmentError &&
            t(
              'An alert supports data from a single Environment or All Environments. Pick one try again.'
            )}
          {incompatibleQuery.hasEventTypeError &&
            tct(
              'An alert needs a filter of [error:event.type:error], [default:event.type:default], [transaction:event.type:transaction], [errorDefault:(event.type:error OR event.type:default)]. Use one of these and try again.',
              eventTypeLinks
            )}
          {incompatibleQuery.hasYAxisError &&
            tct(
              'An alert can’t use the metric [yAxis] just yet. Select another metric and try again.',
              {
                yAxis: <StyledCode>{props.eventView.getYAxis()}</StyledCode>,
              }
            )}
        </Fragment>
      )}
      {totalErrors > 1 && (
        <Fragment>
          {t('Yikes! That button didn’t work. Please fix the following problems:')}
          <StyledUnorderedList>
            {incompatibleQuery.hasProjectError && <li>{t('Select one Project.')}</li>}
            {incompatibleQuery.hasEnvironmentError && (
              <li>{t('Select a single Environment or All Environments.')}</li>
            )}
            {incompatibleQuery.hasEventTypeError && (
              <li>
                {tct(
                  'Use the filter [error:event.type:error], [default:event.type:default], [transaction:event.type:transaction], [errorDefault:(event.type:error OR event.type:default)].',
                  eventTypeLinks
                )}
              </li>
            )}
            {incompatibleQuery.hasYAxisError && (
              <li>
                {tct(
                  'An alert can’t use the metric [yAxis] just yet. Select another metric and try again.',
                  {
                    yAxis: <StyledCode>{props.eventView.getYAxis()}</StyledCode>,
                  }
                )}
              </li>
            )}
          </StyledUnorderedList>
        </Fragment>
      )}
    </StyledAlert>
  );
}

const StyledAlert = styled(Alert)`
  color: ${p => p.theme.textColor};
  margin-bottom: 0;
`;

const StyledUnorderedList = styled('ul')`
  margin-bottom: 0;
`;

const StyledCode = styled('code')`
  background-color: transparent;
  padding: 0;
`;
