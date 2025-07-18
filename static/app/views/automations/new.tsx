import {useState} from 'react';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import EditConnectedMonitors from 'sentry/views/automations/components/editConnectedMonitors';
import {makeAutomationBasePathname} from 'sentry/views/automations/pathnames';

function AutomationBreadcrumbs() {
  const organization = useOrganization();
  return (
    <Breadcrumbs
      crumbs={[
        {label: t('Automations'), to: makeAutomationBasePathname(organization.slug)},
        {label: t('New Automation')},
      ]}
    />
  );
}

export default function AutomationNew() {
  const location = useLocation();
  const organization = useOrganization();
  useWorkflowEngineFeatureGate({redirect: true});

  const [connectedIds, setConnectedIds] = useState<Automation['detectorIds']>(() => {
    const connectedIdsQuery = location.query.connectedIds as
      | string
      | string[]
      | undefined;
    if (!connectedIdsQuery) {
      return [];
    }
    const connectedIdsArray = Array.isArray(connectedIdsQuery)
      ? connectedIdsQuery
      : [connectedIdsQuery];
    return connectedIdsArray;
  });

  return (
    <SentryDocumentTitle title={t('New Automation')} noSuffix>
      <Layout.Page>
        <StyledLayoutHeader>
          <Layout.HeaderContent>
            <AutomationBreadcrumbs />
            <Layout.Title>{t('New Automation')}</Layout.Title>
          </Layout.HeaderContent>
        </StyledLayoutHeader>
        <Layout.Body>
          <Layout.Main fullWidth>
            <EditConnectedMonitors
              connectedIds={connectedIds}
              setConnectedIds={setConnectedIds}
            />
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
      <StickyFooter>
        <StickyFooterLabel>{t('Step 1 of 2')}</StickyFooterLabel>
        <Flex gap="md">
          <LinkButton
            priority="default"
            to={makeAutomationBasePathname(organization.slug)}
          >
            {t('Cancel')}
          </LinkButton>
          <LinkButton
            priority="primary"
            to={{
              pathname: `${makeAutomationBasePathname(organization.slug)}new/settings/`,
              ...(connectedIds.length > 0 && {
                query: {connectedIds},
              }),
            }}
          >
            {t('Next')}
          </LinkButton>
        </Flex>
      </StickyFooter>
    </SentryDocumentTitle>
  );
}

const StyledLayoutHeader = styled(Layout.Header)`
  background-color: ${p => p.theme.background};
`;
