import styled from '@emotion/styled';
import {IconLink} from '@sentry/icons/link';
import type {LocationDescriptor} from 'history';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {Link} from '@sentry/scraps/link';

import {SectionHeading} from 'sentry/components/charts/styles';
import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {
  getPerformanceBaseUrl,
  platformToDomainView,
} from 'sentry/views/performance/utils';

import {SidebarSection} from './styles';

type Props = {organization: Organization; project?: Project};

export function ProjectQuickLinks({organization, project}: Props) {
  const domainView = project
    ? platformToDomainView([project], [parseInt(project.id, 10)])
    : 'backend';

  const quickLinks = [
    ...(project?.platform === 'php-laravel'
      ? [
          {
            title: t('Laravel Insights'),
            to: {
              pathname: `/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}/${BACKEND_LANDING_SUB_PATH}/`,
              query: {project: project.id},
            },
            showNewBadge: true,
          },
        ]
      : []),
    ...(project?.platform === 'javascript-nextjs'
      ? [
          {
            title: t('Next.js Insights'),
            to: {
              pathname: `/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}/${FRONTEND_LANDING_SUB_PATH}/`,
              query: {project: project.id},
            },
            showNewBadge: true,
          },
        ]
      : []),
    {
      title: t('User Feedback'),
      to: {
        pathname: `/organizations/${organization.slug}/issues/feedback/`,
        query: {project: project?.id},
      },
    },
    {
      title: t('View Transactions'),
      to: {
        pathname: `${getPerformanceBaseUrl(organization.slug, domainView)}/`,
        query: {project: project?.id},
      },
    },
  ];

  return (
    <SidebarSection>
      <SectionHeading>{t('Quick Links')}</SectionHeading>
      {quickLinks.map(({title, to, showNewBadge}) => (
        <div key={title}>
          <QuickLink to={to}>
            <IconLink />
            <Flex align="center" gap="xs">
              <QuickLinkText>{title}</QuickLinkText>
              {showNewBadge && <FeatureBadge type="new" />}
            </Flex>
          </QuickLink>
        </div>
      ))}
    </SidebarSection>
  );
}

interface QuickLinkProps extends Omit<LinkProps, 'to'> {
  to: LocationDescriptor;
}

function QuickLinkComponent({to, className, children, ...props}: QuickLinkProps) {
  const location = useLocation();

  const toWithQuery =
    typeof to === 'string'
      ? {pathname: to, query: extractSelectionParameters(location.query)}
      : {...to, query: {...extractSelectionParameters(location.query), ...to.query}};

  return (
    <Link to={toWithQuery} className={className} {...props}>
      {children}
    </Link>
  );
}

const QuickLink = styled(QuickLinkComponent)`
  margin-bottom: ${p => p.theme.space.md};
  display: grid;
  align-items: center;
  gap: ${p => p.theme.space.md};
  grid-template-columns: auto 1fr;
`;

const QuickLinkText = styled('span')`
  font-size: ${p => p.theme.font.size.md};
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
