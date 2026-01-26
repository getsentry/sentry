import type {LocationDescriptor} from 'history';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {navigateTo} from 'sentry/actionCreators/navigation';
import {hasEveryAccess} from 'sentry/components/acl/access';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import type {LinkButtonProps} from 'sentry/components/core/button/linkButton';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import {IconSiren} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import type EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import type {AlertType, AlertWizardAlertNames} from 'sentry/views/alerts/wizard/options';
import {
  AlertWizardRuleTemplates,
  DEFAULT_WIZARD_TEMPLATE,
} from 'sentry/views/alerts/wizard/options';
import {makeMonitorCreatePathname} from 'sentry/views/detectors/pathnames';
import {getMetricMonitorUrl} from 'sentry/views/insights/common/utils/getMetricMonitorUrl';

type CreateAlertFromViewButtonProps = Omit<LinkButtonProps, 'aria-label' | 'to'> & {
  /**
   * Discover query used to create the alert
   */
  eventView: EventView;
  organization: Organization;
  projects: Project[];
  alertType?: AlertType;
  className?: string;
  /**
   * Passed in value to override any metrics decision and switch back to transactions dataset.
   * We currently do a few checks on metrics data on performance pages and this passes the decision onward to alerts.
   */
  disableMetricDataset?: boolean;

  /**
   * Called when the user is redirected to the alert builder
   */
  onClick?: () => void;
  referrer?: string;
};

/**
 * Provide a button that can create an alert from an event view.
 * Emits incompatible query issues on click
 */
export function CreateAlertFromViewButton({
  projects,
  eventView,
  organization,
  referrer,
  onClick,
  alertType,
  disableMetricDataset,
  ...buttonProps
}: CreateAlertFromViewButtonProps) {
  const project = projects.find(p => p.id === `${eventView.project[0]}`);
  const queryParams = eventView.generateQueryStringObject();
  if (queryParams.query?.includes(`project:${project?.slug}`)) {
    queryParams.query = (queryParams.query as string).replace(
      `project:${project?.slug}`,
      ''
    );
  }

  const alertTemplate = alertType
    ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      AlertWizardRuleTemplates[alertType]
    : DEFAULT_WIZARD_TEMPLATE;

  const shouldDirectToMonitors = organization.features.includes('workflow-engine-ui');

  const to = shouldDirectToMonitors
    ? getMetricMonitorUrl({
        project,
        environment: queryParams.environment,
        aggregate: queryParams.yAxis ?? alertTemplate.aggregate,
        dataset: alertTemplate.dataset,
        organization,
        query: decodeScalar(queryParams.query),
        referrer,
        eventTypes: alertTemplate.eventTypes,
      })
    : {
        pathname: makeAlertsPathname({
          path: '/new/metric/',
          organization,
        }),
        query: {
          ...queryParams,
          createFromDiscover: true,
          disableMetricDataset,
          referrer,
          ...alertTemplate,
          project: project?.slug,
          aggregate: queryParams.yAxis ?? alertTemplate.aggregate,
        },
      };

  const handleClick = () => {
    onClick?.();
  };

  const createButtonLabel = shouldDirectToMonitors
    ? t('Create Monitor')
    : t('Create Alert');

  return (
    <CreateAlertButton
      organization={organization}
      onClick={handleClick}
      to={to}
      aria-label={createButtonLabel}
      {...buttonProps}
    />
  );
}

type CreateAlertButtonProps = {
  organization: Organization;
  alertOption?: keyof typeof AlertWizardAlertNames;
  hideIcon?: boolean;
  iconProps?: SVGIconProps;
  /**
   * Callback when the button is clicked.
   * This is different from `onClick` which always overrides the default
   * behavior when the button was clicked.
   */
  onEnter?: () => void;
  projectSlug?: string;
  referrer?: string;
  showPermissionGuide?: boolean;
  to?: string | LocationDescriptor;
} & Omit<LinkButtonProps, 'to'>;

export default function CreateAlertButton({
  organization,
  projectSlug,
  iconProps,
  referrer,
  hideIcon,
  showPermissionGuide,
  alertOption,
  onEnter,
  to,
  ...buttonProps
}: CreateAlertButtonProps) {
  const router = useRouter();
  const api = useApi();
  const {projects} = useProjects();
  const shouldDirectToMonitors =
    organization.features.includes('workflow-engine-ui') &&
    !organization.features.includes('workflow-engine-redirect-opt-out');
  const defaultButtonLabel = shouldDirectToMonitors
    ? t('Create Monitor')
    : t('Create Alert');
  const createAlertUrl = (providedProj: string): string => {
    const params = new URLSearchParams();
    if (referrer) {
      params.append('referrer', referrer);
    }
    if (providedProj !== ':projectId') {
      params.append('project', providedProj);
    }
    if (alertOption && !shouldDirectToMonitors) {
      params.append('alert_option', alertOption);
    }
    const queryString = params.toString();
    if (shouldDirectToMonitors) {
      const basePath = makeMonitorCreatePathname(organization.slug);
      return queryString ? `${basePath}?${queryString}` : basePath;
    }
    return (
      makeAlertsPathname({
        path: '/wizard/',
        organization,
      }) + (queryString ? `?${queryString}` : '')
    );
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
    {settingsLink: <Link to={`/settings/${organization.slug}/`} />}
  );

  const renderButton = (hasAccess: boolean) => (
    <LinkButton
      disabled={!hasAccess}
      title={hasAccess ? undefined : permissionTooltipText}
      icon={!hideIcon && <IconSiren {...iconProps} />}
      to={to ?? (projectSlug ? createAlertUrl(projectSlug) : '')}
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
      {buttonProps.children ?? defaultButtonLabel}
    </LinkButton>
  );

  const showGuide = !organization.alertsMemberWrite && !!showPermissionGuide;
  const canCreateAlert =
    isDemoModeActive() ||
    hasEveryAccess(['alerts:write'], {organization}) ||
    projects.some(p => hasEveryAccess(['alerts:write'], {project: p}));
  const hasOrgWrite = hasEveryAccess(['org:write'], {organization});

  return showGuide ? (
    <GuideAnchor
      target={hasOrgWrite ? 'alerts_write_owner' : 'alerts_write_member'}
      onFinish={hasOrgWrite ? enableAlertsMemberWrite : undefined}
    >
      {renderButton(canCreateAlert)}
    </GuideAnchor>
  ) : (
    renderButton(canCreateAlert)
  );
}
