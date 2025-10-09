import {useState} from 'react';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text/text';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {StickyFooter} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {AutomationFeedbackButton} from 'sentry/views/automations/components/automationFeedbackButton';
import {ConnectMonitorsContent} from 'sentry/views/automations/components/editConnectedMonitors';
import {makeAutomationBasePathname} from 'sentry/views/automations/pathnames';
import {makeMonitorCreatePathname} from 'sentry/views/detectors/pathnames';

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
    <SentryDocumentTitle title={t('New Automation')}>
      <Layout.Page>
        <StyledLayoutHeader>
          <Layout.HeaderContent>
            <AutomationBreadcrumbs />
            <Layout.Title>{t('New Automation')}</Layout.Title>
          </Layout.HeaderContent>
          <AutomationFeedbackButton />
        </StyledLayoutHeader>
        <Layout.Body>
          <Layout.Main fullWidth>
            <ConnectMonitorsContent
              initialIds={connectedIds}
              saveConnectedIds={setConnectedIds}
              footerContent={
                <LinkButton
                  icon={<IconAdd />}
                  href={makeMonitorCreatePathname(organization.slug)}
                  external
                >
                  {t('Create New Monitor')}
                </LinkButton>
              }
            />
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
      <StickyFooter>
        <Text size="md">{t('Step 1 of 2')}</Text>
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
