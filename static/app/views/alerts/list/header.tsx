import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';

import {navigateTo} from 'sentry/actionCreators/navigation';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import CreateAlertButton from 'sentry/components/createAlertButton';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import * as Layout from 'sentry/components/layouts/thirds';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type Props = {
  activeTab: 'stream' | 'rules';
  router: InjectedRouter;
};

const AlertHeader = ({router, activeTab}: Props) => {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  /**
   * Incidents list is currently at the organization level, but the link needs to
   * go down to a specific project scope.
   */
  const handleNavigateToSettings = (e: React.MouseEvent) => {
    e.preventDefault();
    navigateTo(`/settings/${organization.slug}/projects/:projectId/alerts/`, router);
  };

  const alertRulesLink = (
    <li className={activeTab === 'rules' ? 'active' : ''}>
      <GlobalSelectionLink to={`/organizations/${organization.slug}/alerts/rules/`}>
        {t('Alert Rules')}
      </GlobalSelectionLink>
    </li>
  );

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <StyledLayoutTitle>{t('Alerts')}</StyledLayoutTitle>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <Actions gap={1}>
          <CreateAlertButton
            organization={organization}
            iconProps={{size: 'sm'}}
            size="sm"
            priority="primary"
            referrer="alert_stream"
            showPermissionGuide
            projectSlug={
              selection.projects.length === 1
                ? ProjectsStore.getById(`${selection.projects[0]}`)?.slug
                : undefined
            }
          >
            {t('Create Alert')}
          </CreateAlertButton>
          <Button
            size="sm"
            onClick={handleNavigateToSettings}
            href="#"
            icon={<IconSettings size="sm" />}
            aria-label={t('Settings')}
          />
        </Actions>
      </Layout.HeaderActions>
      <Layout.HeaderNavTabs underlined>
        {alertRulesLink}
        <li className={activeTab === 'stream' ? 'active' : ''}>
          <GlobalSelectionLink to={`/organizations/${organization.slug}/alerts/`}>
            {t('History')}
          </GlobalSelectionLink>
        </li>
      </Layout.HeaderNavTabs>
    </Layout.Header>
  );
};

export default AlertHeader;

const StyledLayoutTitle = styled(Layout.Title)`
  margin-top: ${space(0.5)};
`;

const Actions = styled(ButtonBar)`
  height: 32px;
`;
