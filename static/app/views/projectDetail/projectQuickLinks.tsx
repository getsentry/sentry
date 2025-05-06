import styled from '@emotion/styled';
import type {Location} from 'history';

import {SectionHeading} from 'sentry/components/charts/styles';
import {Tooltip} from 'sentry/components/core/tooltip';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import {IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {
  getPerformanceBaseUrl,
  platformToDomainView,
} from 'sentry/views/performance/utils';

import {SidebarSection} from './styles';

type Props = {
  location: Location;
  organization: Organization;
  project?: Project;
};

function ProjectQuickLinks({organization, project}: Props) {
  const hasNewFeedback = organization.features.includes('user-feedback-ui');
  const domainView: DomainView | undefined = project
    ? platformToDomainView([project], [parseInt(project.id, 10)])
    : 'backend';

  const quickLinks = [
    {
      title: t('User Feedback'),
      to: {
        pathname: hasNewFeedback
          ? `/organizations/${organization.slug}/feedback/`
          : `/organizations/${organization.slug}/user-feedback/`,
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
        .map(({title, to, disabled}) => (
          <div key={title}>
            <Tooltip
              title={t("You don't have access to this feature")}
              disabled={!disabled}
            >
              <QuickLink to={to} disabled={disabled}>
                <IconLink />
                <QuickLinkText>{title}</QuickLinkText>
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
    `
    color: ${p.theme.gray200};
    cursor: not-allowed;
  `}
`;

const QuickLinkText = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
  ${p => p.theme.overflowEllipsis}
`;

export default ProjectQuickLinks;
