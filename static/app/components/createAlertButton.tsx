import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {navigateTo} from 'sentry/actionCreators/navigation';
import Access from 'sentry/components/acl/access';
import Alert from 'sentry/components/alert';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Button, {ButtonProps} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import {IconClose, IconInfo, IconSiren} from 'sentry/icons';
import {SVGIconProps} from 'sentry/icons/svgIcon';
import {t, tct} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {
  Aggregation,
  AGGREGATIONS,
  explodeFieldString,
} from 'sentry/utils/discover/fields';
import useApi from 'sentry/utils/useApi';
import {
  errorFieldConfig,
  transactionFieldConfig,
} from 'sentry/views/alerts/incidentRules/constants';
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

type AlertProps = {
  eventView: EventView;
  incompatibleQuery: IncompatibleQueryProperties;
  /**
   * Dismiss alert
   */
  onClose: () => void;
  orgId: string;
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
  const {hasProjectError, hasEnvironmentError, hasEventTypeError, hasYAxisError} =
    incompatibleQuery;

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
        icon={<IconClose size="sm" />}
        aria-label={t('Close')}
        size="zero"
        onClick={onClose}
        borderless
      />
    </StyledAlert>
  );
}

type CreateAlertFromViewButtonProps = ButtonProps & {
  /**
   * Discover query used to create the alert
   */
  eventView: EventView;
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
  organization: Organization;
  projects: Project[];
  className?: string;
  referrer?: string;
};

function incompatibleYAxis(eventView: EventView): boolean {
  const column = explodeFieldString(eventView.getYAxis());
  if (column.kind === 'field' || column.kind === 'equation') {
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
  const queryParams = eventView.generateQueryStringObject();
  if (queryParams.query?.includes(`project:${project?.slug}`)) {
    queryParams.query = (queryParams.query as string).replace(
      `project:${project?.slug}`,
      ''
    );
  }

  const hasErrors = Object.values(errors).some(x => x);
  const to = hasErrors
    ? undefined
    : {
        pathname: `/organizations/${organization.slug}/alerts/${project?.slug}/new/`,
        query: {
          ...queryParams,
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
      aria-label={t('Create Alert')}
      {...buttonProps}
    />
  );
}

type Props = {
  organization: Organization;
  hideIcon?: boolean;
  iconProps?: SVGIconProps;
  projectSlug?: string;
  referrer?: string;
  showPermissionGuide?: boolean;
} & WithRouterProps &
  ButtonProps;

const CreateAlertButton = withRouter(
  ({
    organization,
    projectSlug,
    iconProps,
    referrer,
    router,
    hideIcon,
    showPermissionGuide,
    ...buttonProps
  }: Props) => {
    const api = useApi();

    const createAlertUrl = (providedProj: string) => {
      const alertsBaseUrl = `/organizations/${organization.slug}/alerts/${providedProj}`;
      return `${alertsBaseUrl}/wizard/${referrer ? `?referrer=${referrer}` : ''}`;
    };

    function handleClickWithoutProject(event: React.MouseEvent) {
      event.preventDefault();

      navigateTo(createAlertUrl(':projectId'), router);
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
        to={projectSlug ? createAlertUrl(projectSlug) : undefined}
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
  }
`;
