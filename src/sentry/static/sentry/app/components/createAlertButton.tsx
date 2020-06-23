import React from 'react';
import styled from '@emotion/styled';

import {Project, Organization} from 'app/types';
import {t, tct} from 'app/locale';
import {IconInfo, IconClose, IconSiren} from 'app/icons';
import Button from 'app/components/button';
import EventView from 'app/utils/discover/eventView';
import Alert from 'app/components/alert';
import space from 'app/styles/space';

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
  /**
   * Dismiss alert
   */
  onClose: () => void;
};

/**
 * Displays messages to the user on what needs to change in their query
 */
function IncompatibleQueryAlert({incompatibleQuery, onClose}: AlertProps) {
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
            t('Select one or all Environments to create a new alert.')}
          {hasEventTypeError &&
            tct(
              'Select either [errors:event.type:error] or [transactions:event.type.transactions] to create a new alert.',
              {
                errors: <StyledCode />,
                transactions: <StyledCode />,
              }
            )}
          {hasYAxisError &&
            tct(
              '[unique:count_unique(user)] on [transactions:event.type:transaction] is not supported by alerts just yet. Select a different metric below and try again.',
              {
                unique: <StyledCode />,
                transactions: <StyledCode />,
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
                  'Either [errors:event.type:error] or [transactions:event.type.transactions] is required',
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
                  '[unique:count_unique(user)] on [transactions:event.type:transaction] is not supported by alerts just yet. Select a different metric below and try again.',
                  {
                    unique: <StyledCode />,
                    transactions: <StyledCode />,
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
  eventView: EventView;
  organization: Organization;
  /**
   * Called when the eventView does not meet the requirements of alert rules
   */
  onIncompatibleQuery: (incompatibleQuery: React.ReactNode) => void;
  /**
   * Called when the user is redirected to the alert builder
   */
  onSuccess: () => void;
  onClose: () => void;
};

/**
 * Provide a button that can create an alert from an event view.
 * Emits incompatible query issues on click
 */
class CreateAlertButton extends React.Component<Props> {
  render() {
    const {
      projects,
      eventView,
      organization,
      onIncompatibleQuery,
      onSuccess,
      onClose,
      ...buttonProps
    } = this.props;
    // Must have exactly one project selected and not -1 (all projects)
    const hasProjectError = eventView.project.length !== 1 || eventView.project[0] === -1;
    // Must have one or zero environments
    const hasEnvironmentError = eventView.environment.length > 1;
    // Must have event.type of error or transaction
    const hasEventTypeError =
      !eventView.query.includes('event.type:error') &&
      !eventView.query.includes('event.type:transaction');
    const project = projects.find(p => p.id === String(eventView.project[0]));
    const errors: IncompatibleQueryProperties = {
      hasProjectError,
      hasEnvironmentError,
      hasEventTypeError,
      // TODO(scttcper): yAxis errors
      hasYAxisError: false,
    };
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
          <IncompatibleQueryAlert incompatibleQuery={errors} onClose={onClose} />
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
}

export default CreateAlertButton;

const StyledAlert = styled(Alert)`
  color: ${p => p.theme.gray700};
  margin-bottom: ${space(1)};
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
