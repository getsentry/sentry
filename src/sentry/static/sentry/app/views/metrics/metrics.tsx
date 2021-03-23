import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import * as Layout from 'app/components/layouts/thirds';
import Link from 'app/components/links/link';
import ListItem from 'app/components/list/listItem';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import {getCurrentMetricsTab, MetricsTab} from './utils';

type Props = RouteComponentProps<{}, {}> & {
  organization: Organization;
  children: React.ReactNode;
};

function Metrics({organization, children, routes}: Props) {
  const {currentTab} = getCurrentMetricsTab(routes);
  const orgSlug = organization.slug;

  return (
    <GlobalSelectionHeader skipLoadLastUsed>
      <StyledPageContent>
        <BorderlessHeader>
          <StyledLayoutHeaderContent>
            <StyledLayoutTitle>{t('Metrics')}</StyledLayoutTitle>
          </StyledLayoutHeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <Button
                title={t(
                  "You’re seeing the metrics project because you have the feature flag 'organizations:metrics' enabled. Send us feedback via email."
                )}
                href="mailto:metrics-feedback@sentry.io?subject=Metrics Feedback"
              >
                {t('Give Feedback')}
              </Button>
            </ButtonBar>
          </Layout.HeaderActions>
        </BorderlessHeader>
        <TabLayoutHeader>
          <Layout.HeaderNavTabs underlined>
            <ListItem className={currentTab === MetricsTab.EXPLORER ? 'active' : ''}>
              <Link to={`/organizations/${orgSlug}/metrics/explorer/`}>
                {t('Explorer')}
              </Link>
            </ListItem>
            <ListItem className={currentTab === MetricsTab.DASHBOARDS ? 'active' : ''}>
              <Link to={`/organizations/${orgSlug}/metrics/dashboards/`}>
                {t('Dashboards')}
              </Link>
            </ListItem>
          </Layout.HeaderNavTabs>
        </TabLayoutHeader>
        <Layout.Body>
          <Layout.Main fullWidth>{children}</Layout.Main>
        </Layout.Body>
      </StyledPageContent>
    </GlobalSelectionHeader>
  );
}

export default withOrganization(Metrics);

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const BorderlessHeader = styled(Layout.Header)`
  border-bottom: 0;

  /* Not enough buttons to change direction for mobile view */
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    flex-direction: row;
  }
`;

const TabLayoutHeader = styled(Layout.Header)`
  padding-top: 0;

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    padding-top: 0;
  }
`;

const StyledLayoutHeaderContent = styled(Layout.HeaderContent)`
  margin-bottom: 0;
  margin-right: ${space(2)};
`;

const StyledLayoutTitle = styled(Layout.Title)`
  margin-top: ${space(0.5)};
`;
