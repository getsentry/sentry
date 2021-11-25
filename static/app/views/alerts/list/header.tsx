import * as React from 'react';
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
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';

type Props = {
  router: InjectedRouter;
  organization: Organization;
  activeTab: 'stream' | 'rules';
};

const AlertHeader = ({router, organization, activeTab}: Props) => {
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
    <React.Fragment>
      <BorderlessHeader>
        <StyledLayoutHeaderContent>
          <StyledLayoutTitle>{t('Alerts')}</StyledLayoutTitle>
        </StyledLayoutHeaderContent>
        <Layout.HeaderActions>
          <Actions gap={1}>
            <CreateAlertButton
              organization={organization}
              iconProps={{size: 'sm'}}
              priority="primary"
              referrer="alert_stream"
              showPermissionGuide
            >
              {t('Create Alert Rule')}
            </CreateAlertButton>
            <Button
              onClick={handleNavigateToSettings}
              href="#"
              icon={<IconSettings size="sm" />}
              aria-label="Settings"
            />
          </Actions>
        </Layout.HeaderActions>
      </BorderlessHeader>
      <TabLayoutHeader>
        <Layout.HeaderNavTabs underlined>
          {alertRulesLink}
          <li className={activeTab === 'stream' ? 'active' : ''}>
            <GlobalSelectionLink to={`/organizations/${organization.slug}/alerts/`}>
              {t('History')}
            </GlobalSelectionLink>
          </li>
        </Layout.HeaderNavTabs>
      </TabLayoutHeader>
    </React.Fragment>
  );
};

export default AlertHeader;

const BorderlessHeader = styled(Layout.Header)`
  border-bottom: 0;

  /* Not enough buttons to change direction for tablet view */
  grid-template-columns: 1fr auto;
`;

const StyledLayoutHeaderContent = styled(Layout.HeaderContent)`
  margin-bottom: 0;
  margin-right: ${space(2)};
`;

const StyledLayoutTitle = styled(Layout.Title)`
  margin-top: ${space(0.5)};
`;

const TabLayoutHeader = styled(Layout.Header)`
  padding-top: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    padding-top: ${space(1)};
  }
`;

const Actions = styled(ButtonBar)`
  height: 32px;
`;
