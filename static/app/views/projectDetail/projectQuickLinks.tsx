import styled from '@emotion/styled';
import type {Location} from 'history';

import {SectionHeading} from 'sentry/components/charts/styles';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import {Tooltip} from 'sentry/components/tooltip';
import {IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DEFAULT_MAX_DURATION} from 'sentry/views/performance/trends/utils';
import {
  getPerformanceLandingUrl,
  getPerformanceTrendsUrl,
} from 'sentry/views/performance/utils';

import {SidebarSection} from './styles';

type Props = {
  location: Location;
  organization: Organization;
  project?: Project;
};

function ProjectQuickLinks({organization, project, location}: Props) {
  function getTrendsLink() {
    const queryString = decodeScalar(location.query.query);
    const conditions = new MutableSearch(queryString || '');
    conditions.setFilterValues('tpm()', ['>0.01']);
    conditions.setFilterValues('transaction.duration', [
      '>0',
      `<${DEFAULT_MAX_DURATION}`,
    ]);

    return {
      pathname: getPerformanceTrendsUrl(organization),
      query: {
        project: project?.id,
        cursor: undefined,
        query: conditions.formatString(),
      },
    };
  }

  const quickLinks = [
    {
      title: t('User Feedback'),
      to: {
        pathname: `/organizations/${organization.slug}/user-feedback/`,
        query: {project: project?.id},
      },
    },
    {
      title: t('View Transactions'),
      to: {
        pathname: getPerformanceLandingUrl(organization),
        query: {project: project?.id},
      },
      disabled: !organization.features.includes('performance-view'),
    },
    {
      title: t('Most Improved/Regressed Transactions'),
      to: getTrendsLink(),
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
