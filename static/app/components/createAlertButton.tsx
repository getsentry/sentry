import type {LocationDescriptor} from 'history';

import type {LinkButtonProps} from '@sentry/scraps/button';
import {LinkButton} from '@sentry/scraps/button';
import {Link} from '@sentry/scraps/link';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {IconSiren} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import type {EventView} from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useProjects} from 'sentry/utils/useProjects';
import type {AlertType} from 'sentry/views/alerts/wizard/options';
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

  const to = getMetricMonitorUrl({
    project,
    environment: queryParams.environment,
    aggregate: queryParams.yAxis ?? alertTemplate.aggregate,
    dataset: alertTemplate.dataset,
    organization,
    query: decodeScalar(queryParams.query),
    referrer,
    eventTypes: alertTemplate.eventTypes,
  });

  const handleClick = () => {
    onClick?.();
  };

  return (
    <CreateAlertButton
      organization={organization}
      onClick={handleClick}
      to={to}
      aria-label={t('Create Monitor')}
      {...buttonProps}
    />
  );
}

type CreateAlertButtonProps = {
  organization: Organization;
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
  to?: string | LocationDescriptor;
} & Omit<LinkButtonProps, 'to'>;

export function CreateAlertButton({
  organization,
  projectSlug,
  iconProps,
  referrer,
  hideIcon,
  onEnter,
  to,
  ...buttonProps
}: CreateAlertButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const {projects} = useProjects();
  const createAlertUrl = (providedProj: string): string => {
    const params = new URLSearchParams();
    if (referrer) {
      params.append('referrer', referrer);
    }
    if (providedProj !== ':projectId') {
      params.append('project', providedProj);
    }
    const queryString = params.toString();
    const basePath = makeMonitorCreatePathname(organization.slug);
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  function handleClickWithoutProject(event: React.MouseEvent) {
    event.preventDefault();
    onEnter?.();

    navigateTo(createAlertUrl(':projectId'), navigate, location);
  }

  const permissionTooltipText = tct(
    'Ask your organization owner or manager to [settingsLink:enable alerts access] for you.',
    {settingsLink: <Link to={`/settings/${organization.slug}/`} />}
  );

  const canCreateAlert =
    isDemoModeActive() ||
    hasEveryAccess(['alerts:write'], {organization}) ||
    projects.some(p => hasEveryAccess(['alerts:write'], {project: p}));

  return (
    <LinkButton
      disabled={!canCreateAlert}
      icon={!hideIcon && <IconSiren {...iconProps} />}
      to={to ?? (projectSlug ? createAlertUrl(projectSlug) : '')}
      tooltipProps={{
        title: canCreateAlert ? undefined : permissionTooltipText,
        isHoverable: true,
        position: 'top',
        overlayStyle: {
          maxWidth: '270px',
        },
      }}
      onClick={projectSlug ? onEnter : handleClickWithoutProject}
      {...buttonProps}
    >
      {buttonProps.children ?? t('Create Monitor')}
    </LinkButton>
  );
}
