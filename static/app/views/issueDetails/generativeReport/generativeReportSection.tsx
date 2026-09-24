import {Fragment, useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {TimeSince} from 'sentry/components/timeSince';
import {IconOpen, IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {issueCommentsQueryOptions} from 'sentry/views/issueDetails/activitySection/issueCommentsQueryOptions';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';
import {
  buildReportSrcDoc,
  findLatestReportNote,
  GENERATIVE_REPORT_MARKER,
  getReportHtml,
} from 'sentry/views/issueDetails/generativeReport/utils';

const MIN_FRAME_HEIGHT = 240;
const MAX_FRAME_HEIGHT = 1600;

/**
 * Prototype: a scheduled external agent (Sentry MCP + Supabase MCP) generates
 * an HTML report and posts it as a marker-tagged comment on the issue. This
 * section finds the latest such comment and renders it in a sandboxed iframe.
 * The UI never talks to Supabase directly — it only reads the Sentry comment.
 */
export function GenerativeReportSection({group}: {group: Group}) {
  const organization = useOrganization();

  const {data: comments} = useQuery(
    issueCommentsQueryOptions({organizationSlug: organization.slug, groupId: group.id})
  );

  const report = findLatestReportNote(comments ?? group.activity);

  if (!report) {
    return (
      <FoldSection
        sectionKey={SectionKey.GENERATIVE_REPORT}
        title={t('Generative Report')}
        initialCollapse
      >
        <Stack gap="md" align="start">
          <Text variant="muted">
            {t(
              'No report yet. Hire an agent to generate an HTML snapshot from Sentry + Supabase and post it back to this issue.'
            )}
          </Text>
          <ReportSetupDropdown group={group} orgSlug={organization.slug} size="sm" />
        </Stack>
      </FoldSection>
    );
  }

  return (
    <FoldSection
      sectionKey={SectionKey.GENERATIVE_REPORT}
      title={t('Generative Report')}
      actions={
        <ReportSetupDropdown group={group} orgSlug={organization.slug} size="xs" />
      }
    >
      <Stack gap="md">
        <Text variant="muted" size="sm">
          {t('Snapshot generated')} <TimeSince date={report.dateCreated} />
        </Text>
        <ReportIframe html={getReportHtml(report.data.text)} />
      </Stack>
    </FoldSection>
  );
}

/**
 * The "hire an agent" surface. A single entry point that presents the routine as
 * a product experience: a highlighted (aspirational) one-click "Automate with
 * Seer" path, plus copy-the-prompt paths for the coding agents a user already
 * runs (Claude, Codex, Cursor). Only the copy paths are wired today; the Seer
 * path opens an explainer of the one-click vision.
 */
const AGENT_TARGETS: ReadonlyArray<{href: string; key: string; name: string}> = [
  {key: 'claude', name: 'Claude', href: 'https://claude.ai/new'},
  {key: 'codex', name: 'Codex', href: 'https://chatgpt.com/codex'},
  {key: 'cursor', name: 'Cursor', href: 'https://cursor.com'},
];

function ReportSetupDropdown({
  group,
  orgSlug,
  size,
}: {
  group: Group;
  orgSlug: string;
  size: 'xs' | 'sm';
}) {
  const {copy} = useCopyToClipboard();

  const copyForAgent = (name: string) => {
    copy(buildAgentPrompt(group, orgSlug));
    addSuccessMessage(
      t('Prompt copied — paste it into %s to set up the weekly routine.', name)
    );
  };

  const items: MenuItemProps[] = [
    {
      key: 'automate',
      label: t('Automate'),
      children: [
        {
          key: 'seer',
          label: t('Automate with Seer'),
          details: t(
            'One-click, DB-aware root cause — no external agent. Requires connecting Supabase to Seer.'
          ),
          leadingItems: <IconSeer size="sm" />,
          priority: 'primary',
          onAction: openSeerAutomationModal,
        },
      ],
    },
    {
      key: 'byo-agent',
      label: t('Run it with your own agent'),
      children: AGENT_TARGETS.map(target => ({
        key: target.key,
        label: t('Copy prompt for %s', target.name),
        details: t('Copies the routine prompt and opens %s.', target.name),
        leadingItems: <IconOpen size="sm" />,
        externalHref: target.href,
        onAction: () => copyForAgent(target.name),
      })),
    },
  ];

  return (
    <DropdownMenu
      items={items}
      triggerLabel={t('Set up report')}
      triggerProps={{size, icon: <IconSeer size="xs" />}}
      position="bottom-end"
    />
  );
}

function openSeerAutomationModal() {
  openModal(({Header, Body, Footer, closeModal}) => (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">
          <Stack direction="row" gap="sm" align="center">
            <IconSeer size="sm" />
            {t('Automate with Seer')}
          </Stack>
        </Heading>
      </Header>
      <Body>
        <Stack gap="md">
          <Text>
            {t(
              'Instead of copying a prompt into an external agent, Seer runs the database-aware SRE routine for you — weekly across your top issues — and posts a report only when there is a genuine DB-layer finding.'
            )}
          </Text>
          <Text variant="muted" size="sm">
            {t(
              'This is a preview. The one-click experience requires connecting your Supabase project to Seer so it can read advisors, query stats, and logs directly.'
            )}
          </Text>
        </Stack>
      </Body>
      <Footer>
        <Stack direction="row" gap="sm" justify="end">
          <Button size="sm" onClick={closeModal}>
            {t('Maybe later')}
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              addSuccessMessage(
                t('Thanks — Supabase-to-Seer connectors are coming soon.')
              );
              closeModal();
            }}
          >
            {t('Connect Supabase to Seer')}
          </Button>
        </Stack>
      </Footer>
    </Fragment>
  ));
}

/**
 * Renders the report in a sandboxed iframe, wrapping the agent's HTML body
 * fragment in a Sentry-themed shell and auto-sizing to the content height
 * reported by the shell's resize script.
 */
function ReportIframe({html}: {html: string}) {
  const theme = useTheme();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(MIN_FRAME_HEIGHT);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.source !== frameRef.current?.contentWindow ||
        event.data?.type !== 'gr-height'
      ) {
        return;
      }
      const next = Number(event.data.height);
      if (Number.isFinite(next)) {
        setHeight(Math.min(MAX_FRAME_HEIGHT, Math.max(MIN_FRAME_HEIGHT, next)));
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <ReportFrame
      ref={frameRef}
      sandbox="allow-scripts"
      srcDoc={buildReportSrcDoc(html, theme)}
      title={t('Generative report')}
      style={{height}}
    />
  );
}

function buildAgentPrompt(group: Group, orgSlug: string): string {
  return [
    `You are a Supabase database SRE analyst running a scheduled sweep for Sentry org '${orgSlug}'.`,
    '',
    "MISSION: On each run, review the org's top issues from the last 7 days. For issues that have a",
    'genuine DATABASE-LAYER story Sentry cannot see, post a concise DB report with concrete, linked',
    'Supabase remediation. Stay quiet otherwise — do not add noise to issues that are healthy, already',
    'reported, or not database-related. Surface what Sentry CANNOT see: the state of Postgres behind',
    "the errors. The reader already sees Sentry's metadata and Seer root cause, so do not restate them",
    'beyond a one-line reference — every section should be database signal Sentry does not have.',
    '',
    `STEP 0 — Select issues (Sentry MCP). List the top ~10 unresolved issues by event volume over the`,
    `  last 7 days for org '${orgSlug}' (search_issues, sort by frequency, statsPeriod 7d). Sweep the`,
    `  whole org — not only the issue you were launched from (e.g. ${group.shortId}). Process each below.`,
    '',
    'STEP 1 — Triage (skip noise). For each candidate, fetch its comments and look for the marker',
    `  "${GENERATIVE_REPORT_MARKER}".`,
    '  - If a report already exists: SKIP it — do NOT re-post on a persisting/ignored issue. Record it',
    '    for the run summary (STEP 7). Only refresh if the issue has clearly regressed or spiked since.',
    '  - Otherwise: continue to STEP 2.',
    '',
    "STEP 2 — Investigate the database (Supabase MCP), correlated to the issue's incident window",
    '  (first/last seen). First scope which tables/queries the error implicates (get_sentry_resource):',
    '  - get_advisors: security + performance findings.',
    '  - execute_sql on pg_stat_statements: top queries by total_exec_time, mean_exec_time, calls;',
    '    call out any touching the tables implicated by the error.',
    '  - Index health: unused indexes and seq-scan-heavy large tables (pg_stat_user_tables /',
    '    pg_stat_user_indexes); flag missing-index candidates.',
    '  - Connection & pool pressure: current vs max connections (pg_stat_activity), plus',
    '    Supavisor/pgbouncer pool churn from query_logs.',
    '  - Locks/blocking: blocked queries from pg_locks, especially around the incident window.',
    '  - Health: cache hit ratio, dead tuples / autovacuum lag, table & index sizes and growth.',
    '  - query_logs (postgres_logs): fatal / deadlock / statement-timeout / connection-reset errors',
    '    inside the incident window; correlate timestamps to the error.',
    '  - list_migrations: any migration landing near incident onset.',
    '  DECISION: if there is NO genuine DB-layer signal for this issue, do NOT post to Sentry. Note it',
    '  as "no DB signal" in the run summary (STEP 7) and move to the next issue. Only issues with real',
    '  database evidence get a posted report — this is what keeps the noise down.',
    '',
    'STEP 3 — Enrich Seer (only when it has none). If the issue has NO existing Seer root cause, call',
    '  the Sentry MCP so its first analysis is DB-informed:',
    '    analyze_issue_with_seer(organizationSlug=<org>, issueId=<issue short id>, instruction=<digest>)',
    '  where <digest> is a concise, factual summary of the STEP 2 evidence, phrased as context Seer',
    "  should weigh — not a conclusion (keep under ~10,000 chars; it is appended to Seer's prompt).",
    '  If a root cause already exists, leave it as-is — do not re-run or overwrite it.',
    '',
    'STEP 4 — Write the report as an HTML BODY FRAGMENT (no <html>/<head>/<style>/<script>, no',
    '  hardcoded colors). The Sentry UI injects the theme. Use ONLY these classes:',
    '  gr-card, gr-grid, gr-stat (with .label/.value), gr-badge (+ .danger/.warn/.ok/.muted),',
    '  gr-table, gr-h2, gr-h3, gr-bar (a CSS bar: <div class="gr-bar"><span>label</span>',
    '  <div class="track"><span style="width:70%"></span></div></div>). Charts must be inline SVG or',
    '  gr-bar only — NO external scripts or CDN. Suggested sections: Database health at incident time,',
    '  Slow / expensive queries, Connection & pool pressure, Schema & index risks, DB errors in window,',
    '  DB recommendations.',
    '  MAKE THE RECOMMENDATIONS ACTIONABLE and Supabase-specific: tell the developer exactly what to',
    '  change and why — e.g. move the app to the Supavisor transaction-mode pooler (port 6543) and cap',
    '  the client pool size; add index X on table Y; add an RLS policy; set a statement_timeout. For',
    '  EACH recommendation, use the Supabase MCP search_docs tool to fetch the authoritative doc URL and',
    '  LINK it inline (connection pooling / Supavisor & session-vs-transaction mode, pgbouncer, database',
    '  advisors, indexing, row-level security, query performance). When pooling is relevant, briefly',
    '  explain Supavisor vs a direct connection in plain terms so the developer knows where to go.',
    '',
    'STEP 5 — Prepend this exact marker as the first line, then the HTML fragment:',
    `  ${GENERATIVE_REPORT_MARKER} v1-->`,
    '',
    'STEP 6 — Post one comment per addressed issue via the Sentry REST API (no length limit):',
    `  POST /api/0/organizations/${orgSlug}/issues/<issue numeric id>/comments/`,
    '  body: {"text": "<marker>\\n<fragment>"}',
    "  (Use the add_issue_note MCP tool only if that issue's report is under ~4KB.)",
    '',
    "STEP 7 — Run summary (DO NOT post to Sentry). Output a summary for this routine's own",
    '  notification/log only: issues that got a new DB report, issues skipped (already reported /',
    "  persisting-and-ignored / no DB signal), and any cross-issue database themes worth the team's",
    '  attention. Keeping this out of Sentry avoids nagging on issues the developer already ignores.',
  ].join('\n');
}

const ReportFrame = styled('iframe')`
  width: 100%;
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.primary};
`;
