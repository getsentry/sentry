import {useMemo} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ClaudeCodeIntegrationCta} from 'sentry/components/events/autofix/claudeCodeIntegrationCta';
import {CursorIntegrationCta} from 'sentry/components/events/autofix/cursorIntegrationCta';
import * as Storybook from 'sentry/stories';
import {makeDetailedProjectApiOptions} from 'sentry/utils/project/useDetailedProject';
import {knownAgentIntegrationsQueryOptions} from 'sentry/utils/seer/preferredAgent';
import {getSeerProjectSettingsQueryOptions} from 'sentry/utils/seer/seerProjectSettings';
import {useOrganization} from 'sentry/utils/useOrganization';

// Fake project slug used only for this story — won't hit a real API because we
// pre-seed the QueryClient with canned responses before the component mounts.
const STORY_PROJECT_SLUG = 'cta-story-project';

// Minimal project shape that satisfies the `Project` prop type.
const fakeProject = {
  id: 'story-1',
  slug: STORY_PROJECT_SLUG,
  name: 'CTA Story Project',
} as any;

type StoryState = 'install' | 'configure' | 'configured-cursor' | 'configured-claude';

/**
 * Wraps children in a fresh QueryClient that has all three API responses
 * pre-seeded. This lets us render each CTA state in isolation without needing
 * real Cursor / Claude integrations in the org.
 */
function SeededQueryWrapper({
  children,
  state,
}: {
  children: React.ReactNode;
  state: StoryState;
}) {
  const organization = useOrganization();

  const queryClient = useMemo(() => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          // Prevent automatic background refetches from overwriting our canned data.
          staleTime: Infinity,
          gcTime: Infinity,
        },
      },
    });

    // ── /organizations/{org}/integrations/coding-agents/ ──────────────────
    const integrationKey = knownAgentIntegrationsQueryOptions({organization}).queryKey;
    const hasIntegration = state !== 'install';
    qc.setQueryData(integrationKey, {
      json: {
        integrations: hasIntegration
          ? [
              {id: '42', provider: 'cursor', name: 'Cursor Integration'},
              {id: '99', provider: 'claude_code', name: 'Claude Integration'},
            ]
          : [],
      },
      headers: {},
    });

    // ── /projects/{org}/{project}/seer/settings/ ──────────────────────────
    const seerKey = getSeerProjectSettingsQueryOptions({
      organization,
      project: {slug: STORY_PROJECT_SLUG},
    }).queryKey;

    let agentValue = 'seer';
    let integrationIdValue: string | null = null;
    if (state === 'configured-cursor') {
      agentValue = 'cursor_background_agent';
      integrationIdValue = '42';
    } else if (state === 'configured-claude') {
      agentValue = 'claude_code_agent';
      integrationIdValue = '99';
    }

    qc.setQueryData(seerKey, {
      json: {
        projectId: 'story-1',
        projectSlug: STORY_PROJECT_SLUG,
        agent: agentValue,
        integrationId: integrationIdValue,
        stoppingPoint: 'root_cause',
        autoCreatePr: false,
        automationTuning: 'medium',
        scannerAutomation: true,
        reposCount: 0,
      },
      headers: {},
    });

    // ── /projects/{org}/{project}/ (useDetailedProject) ──────────────────
    const projectKey = makeDetailedProjectApiOptions({
      orgSlug: organization.slug,
      projectSlug: STORY_PROJECT_SLUG,
    }).queryKey;

    qc.setQueryData(projectKey, {
      json: {
        id: 'story-1',
        slug: STORY_PROJECT_SLUG,
        name: 'CTA Story Project',
        seerScannerAutomation: true,
        autofixAutomationTuning: 'medium',
        features: [],
        teams: [],
        organization,
      },
      headers: {},
    });

    return qc;
    // organization is stable for the lifetime of the story page; re-running on
    // state change gives us fresh canned data for each story panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization, state]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export default Storybook.story('CodingAgentIntegrationCta', story => {
  story('Stage 1 — No integration installed', () => {
    return (
      <SeededQueryWrapper state="install">
        <Flex direction="column" gap="xl">
          <Text variant="muted">
            Shows the "Install" card when the org has no Cursor or Claude integration.
          </Text>
          <CursorIntegrationCta project={fakeProject} />
          <ClaudeCodeIntegrationCta project={fakeProject} />
        </Flex>
      </SeededQueryWrapper>
    );
  });

  story('Stage 2 — Integration installed, handoff not configured', () => {
    return (
      <SeededQueryWrapper state="configure">
        <Flex direction="column" gap="xl">
          <Text variant="muted">
            Shows the "Set Seer to hand off to …" button. Clicking it would call PUT
            /seer/settings/ in a real org.
          </Text>
          <CursorIntegrationCta project={fakeProject} />
          <ClaudeCodeIntegrationCta project={fakeProject} />
        </Flex>
      </SeededQueryWrapper>
    );
  });

  story('Stage 3 — Cursor handoff active', () => {
    return (
      <SeededQueryWrapper state="configured-cursor">
        <Flex direction="column" gap="xl">
          <Text variant="muted">
            Cursor CTA shows the active/configured state. Claude CTA shows the
            "not configured" button since agent = cursor_background_agent.
          </Text>
          <CursorIntegrationCta project={fakeProject} />
          <ClaudeCodeIntegrationCta project={fakeProject} />
        </Flex>
      </SeededQueryWrapper>
    );
  });

  story('Stage 3 — Claude handoff active', () => {
    return (
      <SeededQueryWrapper state="configured-claude">
        <Flex direction="column" gap="xl">
          <Text variant="muted">
            Claude CTA shows the active/configured state. Cursor CTA shows the
            "not configured" button since agent = claude_code_agent.
          </Text>
          <CursorIntegrationCta project={fakeProject} />
          <ClaudeCodeIntegrationCta project={fakeProject} />
        </Flex>
      </SeededQueryWrapper>
    );
  });
});
