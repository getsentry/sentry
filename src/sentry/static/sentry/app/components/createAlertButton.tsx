import React from 'react';
import styled from '@emotion/styled';

import {Project, Organization} from 'app/types';
import {t, tct} from 'app/locale';
import {IconInfo, IconClose, IconSiren} from 'app/icons';
import Button from 'app/components/button';
import EventView from 'app/utils/discover/eventView';
import Alert from 'app/components/alert';
import space from 'app/styles/space';
import {explodeFieldString} from 'app/utils/discover/fields';

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
  /**
   * Called when the eventView does not meet the requirements of alert rules
   */
  incompatibleQuery: IncompatibleQueryProperties;
  eventView: EventView;
  /**
   * Dismiss alert
   */
  onClose: () => void;
};

/**
 * Displays messages to the user on what needs to change in their query
 */
function IncompatibleQueryAlert({incompatibleQuery, eventView, onClose}: AlertProps) {
  const {
    hasProjectError,
    hasEnvironmentError,
    hasEventTypeError,
    hasYAxisError,
  } = incompatibleQuery;

  const totalErrors = Object.values(incompatibleQuery).filter(val => val === true).length;

  return (
    <StyledAlert type="warning" icon={<IconInfo color="yellow400" size="sm" />}>
      {totalErrors === 1 && (
        <React.Fragment>
          {hasProjectError && t('Select one project to create a new alert.')}
          {hasEnvironmentError &&
            t('Select one or all environments to create a new alert.')}
          {hasEventTypeError &&
            tct(
              'Select either [errors:event.type:error] or [transactions:event.type:transaction] to create a new alert.',
              {
                errors: <StyledCode />,
                transactions: <StyledCode />,
              }
            )}
          {hasYAxisError &&
            tct(
              '[yAxis] is not supported by alerts just yet. Select a different metric below and try again.',
              {
                yAxis: <StyledCode>{eventView.getYAxis()}</StyledCode>,
              }
            )}
        </React.Fragment>
      )}
      {totalErrors > 1 && (
        <React.Fragment>
          {t(
            'The world is a cruel and unforgiving place and that button didn’t work because:'
          )}
          <StyledUnorderedList>
            {hasProjectError && <li>{t('One project must be selected')}</li>}
            {hasEnvironmentError && <li>{t('One or All Environments is required')}</li>}
            {hasEventTypeError && (
              <li>
                {tct(
                  'Either [errors:event.type:error] or [transactions:event.type:transaction] is required',
                  {
                    errors: <StyledCode />,
                    transactions: <StyledCode />,
                  }
                )}
              </li>
            )}
            {hasYAxisError && (
              <li>
                {tct(
                  '[yAxis] is not supported by alerts just yet. Select a different metric below and try again.',
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
        icon={<IconClose color="yellow400" size="sm" isCircled />}
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
  /**
   * Called when the eventView does not meet the requirements of alert rules
   */
  onIncompatibleQuery: (incompatibleQuery: React.ReactNode) => void;
  /**
   * Called when the alert close button is clicked
   */
  onClose: () => void;
  /**
   * Called when the user is redirected to the alert builder
   */
  onSuccess: () => void;
};

const ALLOWED_AGGREGATE_FUNCTIONS = [
  'count',
  'count_unique',
  'avg',
  'percentile',
  'failure_rate',
  'apdex',
  'count',
  'p50',
  'p75',
  'p95',
  'p99',
  'p100',
];

const ALLOWED_AGGREGATE_ARGUMENTS = ['', 'user', 'transaction.duration'];

/**
 * Provide a button that can create an alert from an event view.
 * Emits incompatible query issues on click
 */
function CreateAlertButton({
  projects,
  eventView,
  organization,
  onIncompatibleQuery,
  onSuccess,
  onClose,
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
  // Only some yAxis selections work in alert rules
  const column = explodeFieldString(eventView.getYAxis());
  // yAxis must be a function and enabled on alerts
  const hasYAxisError =
    column.kind === 'field' ||
    !ALLOWED_AGGREGATE_FUNCTIONS.includes(column.function[0]) ||
    !ALLOWED_AGGREGATE_ARGUMENTS.includes(column.function[1]);
  const errors: IncompatibleQueryProperties = {
    hasProjectError,
    hasEnvironmentError,
    hasEventTypeError,
    hasYAxisError,
  };
  const project = projects.find(p => p.id === String(eventView.project[0]));
  const hasErrors = Object.values(errors).some(x => x);
  const to = hasErrors
    ? undefined
    : {
        pathname: `/settings/${organization.slug}/projects/${project?.slug}/alerts/new/`,
        query: {
          ...eventView.generateQueryStringObject(),
          createFromDiscover: true,
        },
      };

  const handleClick = (event: React.MouseEvent) => {
    if (hasErrors) {
      event.preventDefault();
      onIncompatibleQuery(
        <IncompatibleQueryAlert
          incompatibleQuery={errors}
          eventView={eventView}
          onClose={onClose}
        />
      );
      return;
    }

    onSuccess();
  };

  return (
    <Button
      type="button"
      icon={<IconSiren />}
      to={to}
      onClick={handleClick}
      {...buttonProps}
    >
      {t('Create alert')}
    </Button>
  );
}

export default CreateAlertButton;

const StyledAlert = styled(Alert)`
  color: ${p => p.theme.gray700};
  margin-bottom: ${space(2)};
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
