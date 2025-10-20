import {useState} from 'react';
import {useTheme} from '@emotion/react';
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
import {useMonitorViewContext} from 'sentry/views/detectors/monitorViewContext';
import {makeMonitorCreatePathname} from 'sentry/views/detectors/pathnames';

function AutomationBreadcrumbs() {
  const organization = useOrganization();
  const {automationsLinkPrefix} = useMonitorViewContext();
  return (
    <Breadcrumbs
      crumbs={[
        {
          label: t('Automations'),
          to: makeAutomationBasePathname(organization.slug, automationsLinkPrefix),
        },
        {label: t('New Automation')},
      ]}
    />
  );
}

export default function AutomationNew() {
  const location = useLocation();
  const organization = useOrganization();
  const {automationsLinkPrefix, monitorsLinkPrefix} = useMonitorViewContext();
  useWorkflowEngineFeatureGate({redirect: true});
  const theme = useTheme();
  const maxWidth = theme.breakpoints.lg;

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
      <StyledLayoutPage>
        <StyledLayoutHeader>
          <HeaderInner maxWidth={maxWidth}>
            <Layout.HeaderContent>
              <AutomationBreadcrumbs />
              <Layout.Title>{t('New Automation')}</Layout.Title>
            </Layout.HeaderContent>
            <div>
              <AutomationFeedbackButton />
            </div>
          </HeaderInner>
        </StyledLayoutHeader>
        <StyledBody maxWidth={maxWidth}>
          <Layout.Main fullWidth>
            <ConnectMonitorsContent
              initialIds={connectedIds}
              saveConnectedIds={setConnectedIds}
              footerContent={
                <LinkButton
                  icon={<IconAdd />}
                  href={makeMonitorCreatePathname(organization.slug, monitorsLinkPrefix)}
                  external
                >
                  {t('Create New Monitor')}
                </LinkButton>
              }
            />
          </Layout.Main>
        </StyledBody>
      </StyledLayoutPage>
      <StickyFooter>
        <Flex style={{maxWidth}} align="center" gap="md" justify="end">
          <Text variant="muted" size="md">
            {t('Step 1 of 2')}
          </Text>
          <Flex gap="md">
            <LinkButton
              priority="default"
              to={makeAutomationBasePathname(organization.slug, automationsLinkPrefix)}
            >
              {t('Cancel')}
            </LinkButton>
            <LinkButton
              priority="primary"
              to={{
                pathname: `${makeAutomationBasePathname(organization.slug, automationsLinkPrefix)}new/settings/`,
                ...(connectedIds.length > 0 && {
                  query: {connectedIds},
                }),
              }}
            >
              {t('Next')}
            </LinkButton>
          </Flex>
        </Flex>
      </StickyFooter>
    </SentryDocumentTitle>
  );
}

const StyledLayoutPage = styled(Layout.Page)`
  background-color: ${p => p.theme.background};
`;

const StyledLayoutHeader = styled(Layout.Header)`
  background-color: ${p => p.theme.background};
`;

const HeaderInner = styled('div')<{maxWidth?: string}>`
  display: contents;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    max-width: ${p => p.maxWidth};
    width: 100%;
  }
`;

const StyledBody = styled(Layout.Body)<{maxWidth?: string}>`
  max-width: ${p => p.maxWidth};
  padding: 0;
  margin: ${p => p.theme.space.xl};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: 0;
    margin: ${p =>
      p.noRowGap
        ? `${p.theme.space.xl} ${p.theme.space['3xl']}`
        : `${p.theme.space['2xl']} ${p.theme.space['3xl']}`};
  }
`;
