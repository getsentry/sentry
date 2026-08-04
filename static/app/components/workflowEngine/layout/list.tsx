import {Stack} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {OnboardingBanner} from 'sentry/components/workflowEngine/ui/alertsMonitorsOnboardingBanner';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';

interface WorkflowEngineListLayoutProps {
  actions: React.ReactNode;
  /** The main content for this page */
  children: React.ReactNode;
  description: React.ReactNode;
  docsUrl: string;
  title: string;
}

/**
 * Precomposed full-width layout for Automations / Monitors index pages.
 * The `children` are rendered as the main body content.
 */
export function WorkflowEngineListLayout({
  children,
  actions,
  title,
  description,
  docsUrl,
}: WorkflowEngineListLayoutProps) {
  const organization = useOrganization();

  return (
    <Stack flex={1}>
      <NoProjectMessage organization={organization}>
        <TopBar.Slot name="title">
          {title}
          <PageHeadingQuestionTooltip docsUrl={docsUrl} title={description} />
        </TopBar.Slot>
        <TopBar.Slot name="actions">{actions}</TopBar.Slot>
        <Layout.Body>
          <Layout.Main width="full">
            <Stack gap="lg">
              <OnboardingBanner />
              {children}
            </Stack>
          </Layout.Main>
        </Layout.Body>
      </NoProjectMessage>
    </Stack>
  );
}
