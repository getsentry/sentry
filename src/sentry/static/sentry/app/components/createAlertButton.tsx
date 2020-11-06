import React from 'react';
import styled from '@emotion/styled';

import {Project, Organization} from 'app/types';
import {t, tct} from 'app/locale';
import {IconInfo, IconClose, IconSiren} from 'app/icons';
import Button from 'app/components/button';
import EventView from 'app/utils/discover/eventView';
import Alert from 'app/components/alert';
import Access from 'app/components/acl/access';
import {explodeFieldString, AGGREGATIONS, Aggregation} from 'app/utils/discover/fields';
import {
  errorFieldConfig,
  transactionFieldConfig,
} from 'app/views/settings/incidentRules/constants';
import Link from 'app/components/links/link';

/**
 * Discover query supports more features than alert rules
 * To create an alert rule from a discover query, some parameters need to be adjusted
 */
type IncompatibleQueryProperties = {
  /**
   * Must have exactly one project selected and not -1 (all projects)
   */
  hasProjectError: boolean;
  /**
   * Must have zero or one environments
   */
  hasEnvironmentError: boolean;
  /**
   * event.type must be error or transaction
   */
  hasEventTypeError: boolean;
  hasYAxisError: boolean;
};

type AlertProps = {
  incompatibleQuery: IncompatibleQueryProperties;
  eventView: EventView;
  orgId: string;
  /**
   * Dismiss alert
   */
  onClose: () => void;
};

/**
 * Displays messages to the user on what needs to change in their query
 */
function IncompatibleQueryAlert({
  incompatibleQuery,
  eventView,
  orgId,
  onClose,
}: AlertProps) {
  const {
    hasProjectError,
    hasEnvironmentError,
    hasEventTypeError,
    hasYAxisError,
  } = incompatibleQuery;

  const totalErrors = Object.values(incompatibleQuery).filter(val => val === true).length;

  const eventTypeError = eventView.clone();
  eventTypeError.query += ' event.type:error';
  const eventTypeTransaction = eventView.clone();
  eventTypeTransaction.query += ' event.type:transaction';
  const pathname = `/organizations/${orgId}/discover/results/`;

  return (
    <StyledAlert type="warning" icon={<IconInfo color="yellow300" size="sm" />}>
      {totalErrors === 1 && (
        <React.Fragment>
          {hasProjectError &&
            t('An alert can use data from only one Project. Select one and try again.')}
          {hasEnvironmentError &&
            t(
              'An alert supports data from a single Environment or All Environments. Pick one try again.'
            )}
          {hasEventTypeError &&
            tct(
              'An alert needs a filter of [error:event.type:error] or [transaction:event.type:transaction]. Use one of these and try again.',
              {
                error: (
                  <Link
                    to={{
                      pathname,
                      query: eventTypeError.generateQueryStringObject(),
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
              }
            )}
          {hasYAxisError &&
            tct(
              'An alert can’t use the metric [yAxis] just yet. Select another metric and try again.',
              {
                yAxis: <StyledCode>{eventView.getYAxis()}</StyledCode>,
              }
            )}
        </React.Fragment>
      )}
      {totalErrors > 1 && (
        <React.Fragment>
          {t('Yikes! That button didn’t work. Please fix the following problems:')}
          <StyledUnorderedList>
            {hasProjectError && <li>{t('Select one Project.')}</li>}
            {hasEnvironmentError && (
              <li>{t('Select a single Environment or All Environments.')}</li>
            )}
            {hasEventTypeError && (
              <li>
                {tct(
                  'Use the filter [error:event.type:error] or [transaction:event.type:transaction].',
                  {
                    error: (
                      <Link
                        to={{
                          pathname,
                          query: eventTypeError.generateQueryStringObject(),
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
                  }
                )}
              </li>
            )}
            {hasYAxisError && (
              <li>
                {tct(
                  'An alert can’t use the metric [yAxis] just yet. Select another metric and try again.',
                  {
                    yAxis: <StyledCode>{eventView.getYAxis()}</StyledCode>,
                  }
                )}
              </li>
            )}
          </StyledUnorderedList>
        </React.Fragment>
      )}
      <StyledCloseButton
        icon={<IconClose color="yellow300" size="sm" isCircled />}
        aria-label={t('Close')}
        size="zero"
        onClick={onClose}
        borderless
      />
    </StyledAlert>
  );
}

type Props = React.ComponentProps<typeof Button> & {
  className?: string;
  projects: Project[];
  /**
   * Discover query used to create the alert
   */
  eventView: EventView;
  organization: Organization;
  referrer?: string;
  /**
   * Called when the current eventView does not meet the requirements of alert rules
   * @returns a function that takes an alert close function argument
   */
  onIncompatibleQuery: (
    incompatibleAlertNoticeFn: (onAlertClose: () => void) => React.ReactNode,
    errors: IncompatibleQueryProperties
  ) => void;
  /**
   * Called when the user is redirected to the alert builder
   */
  onSuccess: () => void;
};

function incompatibleYAxis(eventView: EventView): boolean {
  const column = explodeFieldString(eventView.getYAxis());
  if (column.kind === 'field') {
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
  const invalidParameter =
    !isNumericParameter && !['', ...yAxisConfig.fields].includes(column.function[1]);

  return invalidFunction || invalidParameter;
}

/**
 * Provide a button that can create an alert from an event view.
 * Emits incompatible query issues on click
 */
function CreateAlertButton({
  projects,
  eventView,
  organization,
  referrer,
  onIncompatibleQuery,
  onSuccess,
  ...buttonProps
}: Props) {
  // Must have exactly one project selected and not -1 (all projects)
  const hasProjectError = eventView.project.length !== 1 || eventView.project[0] === -1;
  // Must have one or zero environments
  const hasEnvironmentError = eventView.environment.length > 1;
  // Must have event.type of error or transaction
  const hasEventTypeError =
    !eventView.query.includes('event.type:error') &&
    !eventView.query.includes('event.type:transaction');
  // yAxis must be a function and enabled on alerts
  const hasYAxisError = incompatibleYAxis(eventView);
  const errors: IncompatibleQueryProperties = {
    hasProjectError,
    hasEnvironmentError,
    hasEventTypeError,
    hasYAxisError,
  };
  const project = projects.find(p => p.id === `${eventView.project[0]}`);
  const hasErrors = Object.values(errors).some(x => x);
  const to = hasErrors
    ? undefined
    : {
        pathname: `/organizations/${organization.slug}/alerts/${project?.slug}/new/`,
        query: {
          ...eventView.generateQueryStringObject(),
          createFromDiscover: true,
          referrer,
        },
      };

  const handleClick = (event: React.MouseEvent) => {
    if (hasErrors) {
      event.preventDefault();
      onIncompatibleQuery(
        (onAlertClose: () => void) => (
          <IncompatibleQueryAlert
            incompatibleQuery={errors}
            eventView={eventView}
            orgId={organization.slug}
            onClose={onAlertClose}
          />
        ),
        errors
      );
      return;
    }

    onSuccess();
  };

  return (
    <Access organization={organization} access={['project:write']}>
      {({hasAccess}) => (
        <Button
          type="button"
          disabled={!hasAccess}
          title={
            !hasAccess
              ? t('Users with admin permission or higher can create alert rules.')
              : undefined
          }
          icon={<IconSiren />}
          to={to}
          onClick={handleClick}
          {...buttonProps}
        >
          {t('Create alert')}
        </Button>
      )}
    </Access>
  );
}

export default CreateAlertButton;

const StyledAlert = styled(Alert)`
  color: ${p => p.theme.gray700};
  margin-bottom: 0;
`;

const StyledUnorderedList = styled('ul')`
  margin-bottom: 0;
`;

const StyledCode = styled('code')`
  background-color: transparent;
  padding: 0;
`;

const StyledCloseButton = styled(Button)`
  transition: opacity 0.1s linear;
  position: absolute;
  top: 3px;
  right: 0;

  &:hover,
  &:focus {
    background-color: transparent;
    opacity: 1;
  }
`;
