import React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {navigateTo} from 'app/actionCreators/navigation';
import {Client} from 'app/api';
import Access from 'app/components/acl/access';
import Alert from 'app/components/alert';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import Link from 'app/components/links/link';
import {IconClose, IconInfo, IconSiren} from 'app/icons';
import {t, tct} from 'app/locale';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {Aggregation, AGGREGATIONS, explodeFieldString} from 'app/utils/discover/fields';
import withApi from 'app/utils/withApi';
import {getQueryDatasource} from 'app/views/alerts/utils';
import {
  errorFieldConfig,
  transactionFieldConfig,
} from 'app/views/settings/incidentRules/constants';

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
  const eventTypeDefault = eventView.clone();
  eventTypeDefault.query += ' event.type:default';
  const eventTypeErrorDefault = eventView.clone();
  eventTypeErrorDefault.query += ' event.type:error or event.type:default';
  const pathname = `/organizations/${orgId}/discover/results/`;

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
              'An alert needs a filter of [error:event.type:error], [default:event.type:default], [transaction:event.type:transaction], [errorDefault:(event.type:error OR event.type:default)]. Use one of these and try again.',
              eventTypeLinks
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
                  'Use the filter [error:event.type:error], [default:event.type:default], [transaction:event.type:transaction], [errorDefault:(event.type:error OR event.type:default)].',
                  eventTypeLinks
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

type CreateAlertFromViewButtonProps = React.ComponentProps<typeof Button> & {
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

/**
 * Provide a button that can create an alert from an event view.
 * Emits incompatible query issues on click
 */
function CreateAlertFromViewButton({
  projects,
  eventView,
  organization,
  referrer,
  onIncompatibleQuery,
  onSuccess,
  ...buttonProps
}: CreateAlertFromViewButtonProps) {
  // Must have exactly one project selected and not -1 (all projects)
  const hasProjectError = eventView.project.length !== 1 || eventView.project[0] === -1;
  // Must have one or zero environments
  const hasEnvironmentError = eventView.environment.length > 1;
  // Must have event.type of error or transaction
  const hasEventTypeError = getQueryDatasource(eventView.query) === null;
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
    <CreateAlertButton
      organization={organization}
      onClick={handleClick}
      to={to}
      {...buttonProps}
    />
  );
}

type Props = {
  organization: Organization;
  projectSlug?: string;
  iconProps?: React.ComponentProps<typeof IconSiren>;
  referrer?: string;
  hideIcon?: boolean;
  api: Client;
  showPermissionGuide?: boolean;
} & WithRouterProps &
  React.ComponentProps<typeof Button>;

const CreateAlertButton = withApi(
  withRouter(
    ({
      organization,
      projectSlug,
      iconProps,
      referrer,
      router,
      hideIcon,
      api,
      showPermissionGuide,
      ...buttonProps
    }: Props) => {
      function handleClickWithoutProject(event: React.MouseEvent) {
        event.preventDefault();

        if (organization.features.includes('alert-wizard')) {
          navigateTo(
            `/organizations/${organization.slug}/alerts/:projectId/wizard/${
              referrer ? `?referrer=${referrer}` : ''
            }`,
            router
          );
        } else {
          navigateTo(
            `/organizations/${organization.slug}/alerts/:projectId/new/${
              referrer ? `?referrer=${referrer}` : ''
            }`,
            router
          );
        }
      }

      async function enableAlertsMemberWrite() {
        const settingsEndpoint = `/organizations/${organization.slug}/`;
        addLoadingMessage();
        try {
          await api.requestPromise(settingsEndpoint, {
            method: 'PUT',
            data: {
              alertsMemberWrite: true,
            },
          });
          addSuccessMessage(t('Successfully updated organization settings'));
        } catch (err) {
          addErrorMessage(t('Unable to update organization settings'));
        }
      }

      const permissionTooltipText = tct(
        'Ask your organization owner or manager to [settingsLink:enable alerts access] for you.',
        {settingsLink: <Link to={`/settings/${organization.slug}`} />}
      );

      const renderButton = (hasAccess: boolean) => (
        <Button
          disabled={!hasAccess}
          title={!hasAccess ? permissionTooltipText : undefined}
          icon={!hideIcon && <IconSiren {...iconProps} />}
          to={
            projectSlug
              ? `/organizations/${organization.slug}/alerts/${projectSlug}/new/`
              : undefined
          }
          tooltipProps={{
            isHoverable: true,
            position: 'top',
            popperStyle: {
              maxWidth: '270px',
            },
          }}
          onClick={projectSlug ? undefined : handleClickWithoutProject}
          {...buttonProps}
        >
          {buttonProps.children ?? t('Create Alert')}
        </Button>
      );

      const showGuide = !organization.alertsMemberWrite && !!showPermissionGuide;

      return (
        <Access organization={organization} access={['alerts:write']}>
          {({hasAccess}) =>
            showGuide ? (
              <Access organization={organization} access={['org:write']}>
                {({hasAccess: isOrgAdmin}) => (
                  <GuideAnchor
                    target={isOrgAdmin ? 'alerts_write_owner' : 'alerts_write_member'}
                    onFinish={isOrgAdmin ? enableAlertsMemberWrite : undefined}
                  >
                    {renderButton(hasAccess)}
                  </GuideAnchor>
                )}
              </Access>
            ) : (
              renderButton(hasAccess)
            )
          }
        </Access>
      );
    }
  )
);

export {CreateAlertFromViewButton};
export default CreateAlertButton;

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
