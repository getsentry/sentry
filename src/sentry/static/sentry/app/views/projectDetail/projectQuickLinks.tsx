import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {SectionHeading} from 'app/components/charts/styles';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import Tooltip from 'app/components/tooltip';
import {IconLink} from 'app/icons';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {decodeScalar} from 'app/utils/queryString';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import {FilterViews} from 'app/views/performance/landing';
import {DEFAULT_MAX_DURATION} from 'app/views/performance/trends/utils';
import {getPerformanceLandingUrl} from 'app/views/performance/utils';

import {SidebarSection} from './styles';

type Props = {
  organization: Organization;
  location: Location;
  project: Project | null;
};

function ProjectQuickLinks({organization, project, location}: Props) {
  function getTrendsLink() {
    const queryString = decodeScalar(location.query.query);
    const conditions = tokenizeSearch(queryString || '');
    conditions.setTagValues('tpm()', ['>0.01']);
    conditions.setTagValues('transaction.duration', ['>0', `<${DEFAULT_MAX_DURATION}`]);

    return {
      pathname: getPerformanceLandingUrl(organization),
      query: {
        project: project?.id,
        cursor: undefined,
        query: stringifyQueryObject(conditions),
        view: FilterViews.TRENDS,
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
      title: t('Key Transactions'),
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

const QuickLink = styled(p =>
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
  ${overflowEllipsis}
`;

export default ProjectQuickLinks;
