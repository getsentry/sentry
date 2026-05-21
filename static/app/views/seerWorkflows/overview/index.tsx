import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading, Text} from '@sentry/scraps/text';

import {ErrorLevel} from 'sentry/components/events/errorLevel';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {
  IconFilter,
  IconFix,
  IconMerge,
  IconPullRequest,
  IconSettings,
  IconUser,
} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  ATTENTION_META,
  ATTENTION_REASONS,
  AttentionBadge,
  getAttentionReason,
  MergedBadge,
} from './attentionBadge';
import {MOCK_COMPLETED_AUTOFIX_ISSUES} from './mockCompletedIssues';
import {LatestOutcomeChip} from './outcomeChips';
import {TRIGGER_META, TriggerBadge} from './triggerBadge';
import type {
  AttentionReason,
  AutofixOutcome,
  AutofixTrigger,
  CompletedAutofixIssue,
} from './types';

const OUTCOME_FILTER_OPTIONS: Array<{label: string; value: AutofixOutcome}> = [
  {value: 'root_cause', label: t('Root cause')},
  {value: 'solution', label: t('Solution')},
  {value: 'code_changes', label: t('Code changes')},
  {value: 'pr_opened', label: t('PR opened')},
];

const TRIGGER_FILTER_OPTIONS: Array<{label: string; value: AutofixTrigger}> = (
  Object.keys(TRIGGER_META) as AutofixTrigger[]
).map(value => ({value, label: TRIGGER_META[value].label}));

const ATTENTION_FILTER_OPTIONS: Array<{label: string; value: AttentionReason}> =
  ATTENTION_REASONS.map(value => ({value, label: ATTENTION_META[value].label}));

type QuickFilterValue = 'merged' | 'review_pr' | 'awaiting_input' | 'code_changes_ready';

const PERIOD_FILTER_OPTIONS: Array<{label: string; value: string}> = [
  {value: '', label: t('All time')},
  {value: '24h', label: t('Last 24 hours')},
  {value: '7d', label: t('Last 7 days')},
  {value: '30d', label: t('Last 30 days')},
];

const PERIOD_TO_DAYS: Record<string, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
};

export default function AutofixOverview() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const outcomeFilter = decodeList(location.query.outcome) as AutofixOutcome[];
  const triggerFilter = decodeList(location.query.trigger) as AutofixTrigger[];
  const attentionFilter = decodeList(location.query.attention) as AttentionReason[];
  const quickFilter = decodeScalar(location.query.quick) as QuickFilterValue | undefined;
  const period = decodeScalar(location.query.period);

  const updateQuery = (patch: Record<string, string | string[] | undefined>) => {
    navigate(
      {
        pathname: location.pathname,
        query: {...location.query, ...patch},
      },
      {replace: true}
    );
  };

  const toggleQuickFilter = (value: QuickFilterValue) => {
    updateQuery({quick: quickFilter === value ? undefined : value});
  };

  const periodCutoffMs = useMemo(() => {
    const days = PERIOD_TO_DAYS[period ?? ''];
    return days === undefined ? null : Date.now() - days * 24 * 60 * 60 * 1000;
  }, [period]);

  const rowsWithAttention = useMemo(
    () =>
      MOCK_COMPLETED_AUTOFIX_ISSUES.map(row => ({
        row,
        attention: getAttentionReason(row),
      })),
    []
  );

  const filteredRows = useMemo(() => {
    return rowsWithAttention.filter(({row, attention}) => {
      if (outcomeFilter.length && !outcomeFilter.every(o => row.outcomes.includes(o))) {
        return false;
      }
      if (triggerFilter.length && !triggerFilter.includes(row.trigger)) {
        return false;
      }
      if (attentionFilter.length) {
        if (!attention || !attentionFilter.includes(attention)) {
          return false;
        }
      }
      if (quickFilter === 'merged') {
        if (!(row.prMerged && row.prUrl)) return false;
      } else if (quickFilter) {
        if (attention !== quickFilter) return false;
      }
      if (
        periodCutoffMs !== null &&
        Date.parse(row.autofixCompletedAt) < periodCutoffMs
      ) {
        return false;
      }
      return true;
    });
  }, [
    rowsWithAttention,
    outcomeFilter,
    triggerFilter,
    attentionFilter,
    quickFilter,
    periodCutoffMs,
  ]);

  const sortedRows = useMemo(
    () =>
      [...filteredRows].sort(
        (a, b) =>
          Date.parse(b.row.autofixCompletedAt) - Date.parse(a.row.autofixCompletedAt)
      ),
    [filteredRows]
  );

  const stats = useMemo(() => {
    let merged = 0;
    let reviewPr = 0;
    let awaitingInput = 0;
    let codeChangesReady = 0;
    for (const {row, attention} of filteredRows) {
      if (row.prMerged && row.prUrl) merged++;
      if (attention === 'review_pr') reviewPr++;
      if (attention === 'awaiting_input') awaitingInput++;
      if (attention === 'code_changes_ready') codeChangesReady++;
    }
    return {merged, reviewPr, awaitingInput, codeChangesReady};
  }, [filteredRows]);

  const hasActiveFilters =
    outcomeFilter.length > 0 ||
    triggerFilter.length > 0 ||
    attentionFilter.length > 0 ||
    quickFilter !== undefined ||
    (period !== undefined && period !== '');

  const clearAllFilters = () => {
    updateQuery({
      outcome: undefined,
      trigger: undefined,
      attention: undefined,
      quick: undefined,
      period: undefined,
    });
  };

  return (
    <SentryDocumentTitle title={t('Autofix Overview')} orgSlug={organization.slug}>
      <Flex direction="column" gap="lg" padding="xl">
        <Flex justify="between" align="start" gap="md">
          <Flex direction="column" gap="2xs">
            <Heading as="h1">{t('Autofix Overview')}</Heading>
            <Text as="p" variant="muted">
              {t(
                'Issues where Autofix has produced a root cause, solution, code changes, or pull request.'
              )}
            </Text>
          </Flex>
          <Flex gap="sm" align="center">
            <LinkButton to={`/organizations/${organization.slug}/issues/autofix/`}>
              {t('Workflow runs')}
            </LinkButton>
            <LinkButton
              icon={<IconSettings />}
              to={`/organizations/${organization.slug}/issues/autofix/configure/`}
            >
              {t('Configure workflows')}
            </LinkButton>
          </Flex>
        </Flex>

        <Container width={{md: '100%', lg: '85%'}}>
          <Grid
            columns={{xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)'}}
            gap="md"
            marginBottom="md"
          >
            <StatCard
              Icon={IconUser}
              iconVariant="primary"
              label={t('Awaiting your input')}
              value={stats.awaitingInput}
              isActive={quickFilter === 'awaiting_input'}
              onClick={() => toggleQuickFilter('awaiting_input')}
            />
            <StatCard
              Icon={IconFix}
              iconVariant="secondary"
              label={t('Code changes ready')}
              value={stats.codeChangesReady}
              isActive={quickFilter === 'code_changes_ready'}
              onClick={() => toggleQuickFilter('code_changes_ready')}
            />
            <StatCard
              Icon={IconPullRequest}
              iconVariant="warning"
              label={t('Awaiting your review')}
              value={stats.reviewPr}
              isActive={quickFilter === 'review_pr'}
              onClick={() => toggleQuickFilter('review_pr')}
            />
            <StatCard
              Icon={IconMerge}
              iconVariant="success"
              label={t('Merged PRs')}
              value={stats.merged}
              isActive={quickFilter === 'merged'}
              onClick={() => toggleQuickFilter('merged')}
            />
          </Grid>
          <Container
            background="secondary"
            border="muted"
            radius="md"
            padding="sm md"
            marginBottom="md"
          >
            <Flex justify="between" align="center" gap="md" wrap="wrap">
              <Flex gap="md" align="center" wrap="wrap">
                <Text variant="muted" aria-hidden>
                  <IconFilter size="sm" />
                </Text>
                <CompactSelect
                  multiple
                  value={outcomeFilter}
                  options={OUTCOME_FILTER_OPTIONS}
                  onChange={selected =>
                    updateQuery({outcome: selected.map(o => String(o.value))})
                  }
                  trigger={triggerProps => (
                    <OverlayTrigger.Button
                      {...triggerProps}
                      size="sm"
                      prefix={t('Outcome')}
                    />
                  )}
                />
                <CompactSelect
                  multiple
                  value={triggerFilter}
                  options={TRIGGER_FILTER_OPTIONS}
                  onChange={selected =>
                    updateQuery({trigger: selected.map(o => String(o.value))})
                  }
                  trigger={triggerProps => (
                    <OverlayTrigger.Button
                      {...triggerProps}
                      size="sm"
                      prefix={t('Triggered by')}
                    />
                  )}
                />
                <CompactSelect
                  multiple
                  value={attentionFilter}
                  options={ATTENTION_FILTER_OPTIONS}
                  onChange={selected =>
                    updateQuery({attention: selected.map(o => String(o.value))})
                  }
                  trigger={triggerProps => (
                    <OverlayTrigger.Button
                      {...triggerProps}
                      size="sm"
                      prefix={t('Needs attention')}
                    />
                  )}
                />
                <CompactSelect
                  value={period ?? ''}
                  options={PERIOD_FILTER_OPTIONS}
                  onChange={selected =>
                    updateQuery({
                      period: selected.value === '' ? undefined : String(selected.value),
                    })
                  }
                  trigger={triggerProps => (
                    <OverlayTrigger.Button
                      {...triggerProps}
                      size="sm"
                      prefix={t('Completed')}
                    />
                  )}
                />
              </Flex>
              {hasActiveFilters ? (
                <Button size="xs" variant="link" onClick={clearAllFilters}>
                  {t('Clear all')}
                </Button>
              ) : null}
            </Flex>
          </Container>

          <OverviewTable>
            <SimpleTable.Header>
              <SimpleTable.HeaderCell>{t('Issue')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Triggered by')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Activity')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Action')}</SimpleTable.HeaderCell>
            </SimpleTable.Header>

            {sortedRows.length === 0 ? (
              <SimpleTable.Empty>
                {hasActiveFilters
                  ? t('No issues match your filters.')
                  : t('No completed autofix runs yet.')}
              </SimpleTable.Empty>
            ) : (
              sortedRows.map(({row, attention}) => (
                <IssueRow
                  key={row.id}
                  row={row}
                  attention={attention}
                  organizationSlug={organization.slug}
                />
              ))
            )}
          </OverviewTable>
        </Container>
      </Flex>
    </SentryDocumentTitle>
  );
}

type StatIconVariant = 'success' | 'warning' | 'primary' | 'secondary';

const StatCardButton = styled('button')<{isActive: boolean}>`
  cursor: pointer;
  background: ${p =>
    p.isActive ? p.theme.tokens.background.secondary : p.theme.tokens.background.primary};
  border: 1px solid
    ${p => (p.isActive ? p.theme.tokens.border.accent : p.theme.tokens.border.primary)};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => `${p.theme.space.md} ${p.theme.space.lg}`};
  text-align: left;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
  &:hover {
    border-color: ${p => p.theme.tokens.border.accent};
  }
  &:focus-visible {
    outline: 2px solid ${p => p.theme.tokens.focus.default};
    outline-offset: 1px;
  }
`;

function StatCard({
  Icon,
  iconVariant,
  label,
  value,
  isActive,
  onClick,
}: {
  Icon: React.ComponentType<{size?: 'xs' | 'sm' | 'md'}>;
  iconVariant: StatIconVariant;
  isActive: boolean;
  label: string;
  onClick: () => void;
  value: number;
}) {
  return (
    <StatCardButton
      type="button"
      isActive={isActive}
      aria-pressed={isActive}
      onClick={onClick}
    >
      <Flex direction="column" gap="xs">
        <Flex gap="xs" align="center">
          <Flex align="center" justify="center" aria-hidden>
            <Text variant={iconVariant}>
              <Icon size="xs" />
            </Text>
          </Flex>
          <Text size="xs" variant="muted" uppercase>
            {label}
          </Text>
        </Flex>
        <Heading as="h2" size="2xl">
          {value}
        </Heading>
      </Flex>
    </StatCardButton>
  );
}

function IssueRow({
  row,
  attention,
  organizationSlug,
}: {
  attention: AttentionReason | null;
  organizationSlug: string;
  row: CompletedAutofixIssue;
}) {
  const issuePath = `/organizations/${organizationSlug}/issues/${row.id}/`;
  const statusBadge = attention ? (
    <AttentionBadge
      reason={attention}
      to={
        attention === 'review_pr' && row.prUrl
          ? row.prUrl
          : {pathname: issuePath, query: {seerDrawer: 'true'}}
      }
    />
  ) : row.prMerged && row.prUrl ? (
    <MergedBadge to={row.prUrl} />
  ) : null;
  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell>
        <Flex gap="sm" align="center" minWidth="0">
          <ErrorLevel level={row.level} />
          <Flex direction="column" gap="xs" minWidth="0">
            <Link to={issuePath}>
              <Text size="sm" bold variant="accent">
                {row.title}
              </Text>
            </Link>
            <Flex gap="sm" align="center" wrap="wrap">
              <Text size="xs" variant="muted" monospace>
                {row.shortId}
              </Text>
              <LatestOutcomeChip outcomes={row.outcomes} />
            </Flex>
          </Flex>
        </Flex>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Flex direction="column" gap="2xs">
          <TriggerBadge trigger={row.trigger} />
          <Text size="xs" variant="muted">
            <TimeSince date={row.autofixCompletedAt} />
          </Text>
        </Flex>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Flex direction="column" gap="2xs">
          <Text size="sm">
            {tn('%s event', '%s events', row.eventCount)}
            {' · '}
            {tn('%s user', '%s users', row.userCount)}
          </Text>
          <Text size="xs" variant="muted">
            {t('Last seen')} <TimeSince date={row.lastSeen} />
          </Text>
        </Flex>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>{statusBadge}</SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

const OverviewTable = styled(SimpleTable)`
  grid-template-columns: 2fr max-content max-content max-content;
`;
