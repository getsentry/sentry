import React from 'react';
import styled from '@emotion/styled';
import {InjectedRouter} from 'react-router/lib/Router';

import {IconSettings} from 'app/icons';
import {Organization} from 'app/types';
import {PageHeader} from 'app/styles/organization';
import {navigateTo} from 'app/actionCreators/navigation';
import {t} from 'app/locale';
import Feature from 'app/components/acl/feature';
import FeatureBadge from 'app/components/featureBadge';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import PageHeading from 'app/components/pageHeading';
import NavTabs from 'app/components/navTabs';
import space from 'app/styles/space';
import Link from 'app/components/links/link';

import CreateRuleButton from './createRuleButton';

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

  return (
    <React.Fragment>
      <PageHeader>
        <StyledPageHeading>
          {t('Alerts')}{' '}
          <FeatureBadge
            title={
              activeTab === 'stream'
                ? t('This page is in beta and currently only shows metric alerts.')
                : undefined
            }
            type="beta"
          />
        </StyledPageHeading>

        <Actions gap={1}>
          <Button
            onClick={handleNavigateToSettings}
            href="#"
            size="small"
            icon={<IconSettings size="xs" />}
          >
            {t('Settings')}
          </Button>

          <CreateRuleButton organization={organization} router={router} />
        </Actions>
      </PageHeader>
      <StyledNavTabs underlined>
        <Feature
          hookName="feature-disabled:incidents-sidebar-item"
          features={['incidents']}
          organization={organization}
        >
          <li className={activeTab === 'stream' ? 'active' : ''}>
            <Link to={`/organizations/${organization.slug}/alerts/`}>{t('Stream')}</Link>
          </li>
        </Feature>
        <li className={activeTab === 'rules' ? 'active' : ''}>
          <Link to={`/organizations/${organization.slug}/alerts/rules/`}>
            {t('Rules')}
          </Link>
        </li>
      </StyledNavTabs>
    </React.Fragment>
  );
};

export default AlertHeader;

const StyledPageHeading = styled(PageHeading)`
  display: flex;
  align-items: center;
`;

const StyledNavTabs = styled(NavTabs)`
  li {
    margin-right: ${space(0.5)};
  }
  li > a {
    padding: ${space(1)} ${space(2)};
  }
`;

const Actions = styled(ButtonBar)`
  height: 32px;
`;
