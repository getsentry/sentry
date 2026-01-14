import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import {IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {
  getPerformanceBaseUrl,
  platformToDomainView,
} from 'sentry/views/performance/utils';

import {SidebarSection} from './styles';

type Props = {
  organization: Organization;
  project?: Project;
};

function ProjectQuickLinks({organization, project}: Props) {
  const domainView: DomainView | undefined = project
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
        pathname: `/organizations/${organization.slug}/feedback/`,
        query: {project: project?.id},
      },
    },
    {
      title: t('View Transactions'),
      to: {
        pathname: `${getPerformanceBaseUrl(organization.slug, domainView)}/`,
        query: {project: project?.id},
      },
      disabled: !organization.features.includes('performance-view'),
    },
  ];

  return (
    <SidebarSection>
      <SectionHeading>{t('Quick Links')}</SectionHeading>
      {quickLinks
        // push disabled links to the bottom
        .sort((link1, link2) => Number(!!link1.disabled) - Number(!!link2.disabled))
        .map(({title, to, disabled, showNewBadge}) => (
          <div key={title}>
            <Tooltip
              title={t("You don't have access to this feature")}
              disabled={!disabled}
            >
              <QuickLink to={to} disabled={disabled}>
                <IconLink />
                <Flex align="center" gap="xs">
                  <QuickLinkText>{title}</QuickLinkText>
                  {showNewBadge && <FeatureBadge type="new" />}
                </Flex>
              </QuickLink>
            </Tooltip>
          </div>
        ))}
    </SidebarSection>
  );
}

const QuickLink = styled((p: any) =>
  p.disabled ? (
    <span className={p.className}>{p.children}</span>
  ) : (
    <GlobalSelectionLink {...p} />
  )
)<{
  disabled?: boolean;
}>`
  margin-bottom: ${space(1)};
  display: grid;
  align-items: center;
  gap: ${space(1)};
  grid-template-columns: auto 1fr;

  ${p =>
    p.disabled &&
    css`
      color: ${p.theme.colors.gray200};
      cursor: not-allowed;
    `}
`;

const QuickLinkText = styled('span')`
  font-size: ${p => p.theme.fontSize.md};
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export default ProjectQuickLinks;
