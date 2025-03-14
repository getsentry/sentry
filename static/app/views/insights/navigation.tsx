import {Fragment} from 'react';
import styled from '@emotion/styled';

import {NAV_GROUP_LABELS} from 'sentry/components/nav/constants';
import {usePrefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import ProjectIcon from 'sentry/components/nav/projectIcon';
import {SecondaryNav} from 'sentry/components/nav/secondary';
import {PrimaryNavGroup} from 'sentry/components/nav/types';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  AI_LANDING_SUB_PATH,
  AI_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/ai/settings';
import {
  BACKEND_LANDING_SUB_PATH,
  BACKEND_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/backend/settings';
import {
  FRONTEND_LANDING_SUB_PATH,
  FRONTEND_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/frontend/settings';
import {
  MOBILE_LANDING_SUB_PATH,
  MOBILE_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/mobile/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';

import {MODULE_BASE_URLS} from './common/utils/useModuleURL';
import {ModuleName} from './types';

type InsightsNavigationProps = {
  children: React.ReactNode;
};

function InsightsSecondaryNav({children}: InsightsNavigationProps) {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}`;

  const {projects} = useProjects();

  return (
    <Fragment>
      <SecondaryNav group={PrimaryNavGroup.INSIGHTS}>
        <SecondaryNav.Header>
          {NAV_GROUP_LABELS[PrimaryNavGroup.INSIGHTS]}
        </SecondaryNav.Header>
        <SecondaryNav.Body>
          <SecondaryNav.Section>
            <SecondaryNav.Item to={`${baseUrl}/${FRONTEND_LANDING_SUB_PATH}/`}>
              {FRONTEND_SIDEBAR_LABEL}
            </SecondaryNav.Item>
            <SecondaryNav.Item to={`${baseUrl}/${BACKEND_LANDING_SUB_PATH}/`}>
              {BACKEND_SIDEBAR_LABEL}
            </SecondaryNav.Item>
            <SecondaryNav.Item to={`${baseUrl}/${MOBILE_LANDING_SUB_PATH}/`}>
              {MOBILE_SIDEBAR_LABEL}
            </SecondaryNav.Item>
            <SecondaryNav.Item
              to={`${baseUrl}/${AI_LANDING_SUB_PATH}/${MODULE_BASE_URLS[ModuleName.AI]}/`}
            >
              {AI_SIDEBAR_LABEL}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
          <SecondaryNav.Section title={t('Starred Projects')}>
            {projects
              .filter(project => project.isBookmarked)
              .map(project => (
                <SecondaryNav.Item
                  key={project.id}
                  to={`${baseUrl}/projects/${project.slug}/`}
                  leadingItems={
                    <StyledProjectIcon
                      projectPlatforms={project.platform ? [project.platform] : []}
                    />
                  }
                >
                  {project.slug}
                </SecondaryNav.Item>
              ))}
            <SecondaryNav.Item to={`${baseUrl}/projects/`} end>
              {t('All Projects')}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
        </SecondaryNav.Body>
      </SecondaryNav>
      {children}
    </Fragment>
  );
}

export default function InsightsNavigation({children}: InsightsNavigationProps) {
  const prefersStackedNav = usePrefersStackedNav();

  if (!prefersStackedNav) {
    return children;
  }

  return <InsightsSecondaryNav>{children}</InsightsSecondaryNav>;
}

const StyledProjectIcon = styled(ProjectIcon)`
  margin-right: ${space(0.75)};
`;
