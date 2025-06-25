import {useState} from 'react';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Card} from 'sentry/components/workflowEngine/ui/card';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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

  const [connectedIds, setConnectedIds] = useState<Set<string>>(() => {
    const connectedIdsQuery = location.query.connectedIds as
      | string
      | string[]
      | undefined;
    if (!connectedIdsQuery) {
      return new Set<string>();
    }
    const connectedIdsArray = Array.isArray(connectedIdsQuery)
      ? connectedIdsQuery
      : [connectedIdsQuery];
    return new Set(connectedIdsArray);
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
            <Flex direction="column" gap={space(1.5)}>
              <Card>
                <EditConnectedMonitors
                  connectedIds={connectedIds}
                  setConnectedIds={setConnectedIds}
                />
              </Card>
              <span>
                <Button icon={<IconAdd />}>{t('Create New Monitor')}</Button>
              </span>
            </Flex>
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
      <StickyFooter>
        <StickyFooterLabel>{t('Step 1 of 2')}</StickyFooterLabel>
        <Flex gap={space(1)}>
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
              ...(connectedIds.size > 0 && {
                query: {connectedIds: Array.from(connectedIds)},
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
