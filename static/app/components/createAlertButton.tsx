import {Fragment} from 'react';
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
import {IconClose, IconSiren} from 'sentry/icons';
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
} from 'sentry/views/alerts/rules/metric/constants';
import {getQueryDatasource} from 'sentry/views/alerts/utils';
import {
  AlertType,
  AlertWizardAlertNames,
  AlertWizardRuleTemplates,
  DEFAULT_WIZARD_TEMPLATE,
} from 'sentry/views/alerts/wizard/options';

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

  const totalErrors = Object.values(incompatibleQuery).filter(val => val).length;

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
    <StyledAlert
      type="warning"
      showIcon
      trailingItems={
        <Button
          icon={<IconClose size="sm" />}
          aria-label={t('Close')}
          size="zero"
          onClick={onClose}
          borderless
        />
      }
    >
      {totalErrors === 1 && (
        <Fragment>
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
        </Fragment>
      )}
      {totalErrors > 1 && (
        <Fragment>
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
        </Fragment>
      )}
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
  alertType?: AlertType;
  className?: string;
  referrer?: string;
  useAlertWizardV3?: boolean;
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
  useAlertWizardV3,
  alertType,
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

  const alertTemplate = alertType
    ? AlertWizardRuleTemplates[alertType]
    : DEFAULT_WIZARD_TEMPLATE;

  const to = hasErrors
    ? undefined
    : {
        pathname: useAlertWizardV3
          ? `/organizations/${organization.slug}/alerts/new/metric/`
          : `/organizations/${organization.slug}/alerts/${project?.slug}/new/`,
        query: {
          ...queryParams,
          createFromDiscover: true,
          referrer,
          ...(useAlertWizardV3
            ? {
                ...alertTemplate,
                project: project?.slug,
                aggregate: queryParams.yAxis ?? alertTemplate.aggregate,
              }
            : {}),
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
  alertOption?: keyof typeof AlertWizardAlertNames;
  hideIcon?: boolean;
  iconProps?: SVGIconProps;
  /// Callback when the button is clicked.
  /// This is different from `onClick` which always overrides the default
  /// behavior when the button was clicked.
  onEnter?: () => void;
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
    alertOption,
    onEnter,
    ...buttonProps
  }: Props) => {
    const api = useApi();
    const createAlertUrl = (providedProj: string) => {
      const hasAlertWizardV3 = organization.features.includes('alert-wizard-v3');
      const alertsBaseUrl = hasAlertWizardV3
        ? `/organizations/${organization.slug}/alerts`
        : `/organizations/${organization.slug}/alerts/${providedProj}`;
      const alertsArgs = [
        `${referrer ? `referrer=${referrer}` : ''}`,
        `${
          hasAlertWizardV3 && providedProj && providedProj !== ':projectId'
            ? `project=${providedProj}`
            : ''
        }`,
        alertOption ? `alert_option=${alertOption}` : '',
      ].filter(item => item !== '');

      return `${alertsBaseUrl}/wizard/${alertsArgs.length ? '?' : ''}${alertsArgs.join(
        '&'
      )}`;
    };

    function handleClickWithoutProject(event: React.MouseEvent) {
      event.preventDefault();
      onEnter?.();

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
          overlayStyle: {
            maxWidth: '270px',
          },
        }}
        onClick={projectSlug ? onEnter : handleClickWithoutProject}
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
