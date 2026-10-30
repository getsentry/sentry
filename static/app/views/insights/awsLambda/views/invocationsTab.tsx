import {useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {DrawerBody, DrawerHeader, useDrawer} from '@sentry/scraps/drawer';
import {InfoText} from '@sentry/scraps/info';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconClose, IconExpand, IconOpen, IconPause, IconPlay} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {getFormattedDate} from 'sentry/utils/dates';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ComparisonBars,
  type HeatmapSelection,
  LatencyHeatmap,
} from 'sentry/views/insights/awsLambda/charts';
import {
  exploreUrl,
  formatCount,
  formatMs,
  SectionTitle,
  StatusTag,
  TraceWaterfall,
} from 'sentry/views/insights/awsLambda/components';
import {
  useLambdaWindow,
  useMockQuery,
  useNow,
  useUrlListState,
  useUrlState,
} from 'sentry/views/insights/awsLambda/hooks';
import {
  durationHeatmap,
  type Invocation,
  invocations,
  type InvocationStatus,
  type LambdaFunction,
  LIVE_TAIL_MAX_PER_SECOND,
  liveTail,
  logsFor,
  payloadFor,
  releasesOf,
  stackFor,
  type TimeWindow,
  traceSpans,
} from 'sentry/views/insights/awsLambda/mockData';

const PAGE_SIZE = 25;
const STATUSES: InvocationStatus[] = ['ok', 'error', 'timeout', 'oom', 'throttled'];
const STATUS_LABEL: Record<InvocationStatus, string> = {
  ok: 'OK',
  error: 'Error',
  timeout: 'Timeout',
  oom: 'Out of memory',
  throttled: 'Throttled',
};

function parseSelection(value: string | undefined): HeatmapSelection | null {
  if (!value) {
    return null;
  }
  const [minTime, maxTime, minDuration, maxDuration] = value.split(',').map(Number);
  return [minTime, maxTime, minDuration, maxDuration].every(v => Number.isFinite(v))
    ? {
        minTime: minTime!,
        maxTime: maxTime!,
        minDuration: minDuration!,
        maxDuration: maxDuration!,
      }
    : null;
}

type Opener = (inv: Invocation) => void;

export function InvocationsTab({
  fn,
  window,
  now,
  live,
}: {
  fn: LambdaFunction;
  live: boolean;
  now: number;
  window: TimeWindow;
}) {
  const organization = useOrganization();
  const {openDrawer} = useDrawer();
  const [mode, setMode] = useUrlState('mode');
  const [openId, setOpenId] = useUrlState('invocation');

  const open: Opener = inv => {
    setOpenId(inv.id);
    openDrawer(
      () => (
        <InvocationDrawer fn={fn} invocation={inv} organizationSlug={organization.slug} />
      ),
      {
        ariaLabel: t('Invocation %s', inv.requestId),
        drawerKey: 'lambda-invocation',
        resizable: true,
        drawerWidth: '55%',
        shouldCloseOnLocationChange: () => false,
        onClose: () => setOpenId(undefined),
      }
    );
  };

  return (
    <Stack gap="lg" paddingTop="lg">
      <Flex justify="between" align="center" gap="md" wrap="wrap">
        <SegmentedControl<'range' | 'tail'>
          size="xs"
          aria-label={t('Mode')}
          value={mode === 'tail' ? 'tail' : 'range'}
          onChange={next => setMode(next === 'tail' ? 'tail' : undefined)}
        >
          <SegmentedControl.Item key="range">{t('Time range')}</SegmentedControl.Item>
          <SegmentedControl.Item key="tail">{t('Live tail')}</SegmentedControl.Item>
        </SegmentedControl>
        <Text size="xs" variant="muted">
          {mode === 'tail'
            ? t(
                'Every invocation as the extension reports it, unsampled, for as long as this tab is open.'
              )
            : t(
                'Sampled function.aws spans in the page time range; failures are always kept.'
              )}
        </Text>
      </Flex>
      {mode === 'tail' ? (
        <LiveTail key={fn.name} fn={fn} onOpen={open} openId={openId} />
      ) : (
        <RangeInvocations
          fn={fn}
          window={window}
          now={now}
          live={live}
          onOpen={open}
          openId={openId}
        />
      )}
    </Stack>
  );
}

function RangeInvocations({
  fn,
  window,
  now,
  live,
  onOpen,
  openId,
}: {
  fn: LambdaFunction;
  live: boolean;
  now: number;
  onOpen: Opener;
  window: TimeWindow;
  openId?: string;
}) {
  const organization = useOrganization();
  const [statuses, setStatuses] = useUrlListState('status');
  const [cold, setCold] = useUrlState('cold');
  const [release, setRelease] = useUrlState('release');
  const [search, setSearch] = useUrlState('iq');
  const [attrs, setAttrs] = useUrlListState('attr');
  const [selectionParam, setSelectionParam] = useUrlState('sel');
  const [sort, setSort] = useUrlState('isort');
  const [page, setPage] = useState(0);
  const selection = parseSelection(selectionParam);

  const query = useMockQuery(
    ['invocations', fn.name, window.start, window.end, now],
    () => ({
      samples: invocations(fn, window),
      heatmap: durationHeatmap(fn, window),
    })
  );
  const all = useMemo(() => query.data?.samples ?? [], [query.data]);

  // Rows that arrived since the last refresh (live mode) get a highlight.
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!query.data) {
      return;
    }
    if (!seen.current) {
      seen.current = new Set(query.data.samples.map(inv => inv.id));
      return;
    }
    const arrived = query.data.samples
      .filter(inv => !seen.current!.has(inv.id))
      .map(inv => inv.id);
    arrived.forEach(id => seen.current!.add(id));
    if (arrived.length) {
      setFresh(new Set(arrived));
    }
  }, [query.data]);

  // Everything except the heatmap selection: the heatmap shows this set.
  const base = useMemo(() => {
    const q = (search ?? '').toLowerCase();
    return all.filter(inv => {
      if (cold === '1' && !inv.coldStart) {
        return false;
      }
      if (release && inv.release !== release) {
        return false;
      }
      for (const attr of attrs) {
        const [key, value] = attr.split('=', 2);
        if (key && inv.attributes[key] !== value) {
          return false;
        }
      }
      if (
        q &&
        !`${inv.requestId} ${inv.traceId} ${inv.trigger} ${inv.errorType ?? ''} ${Object.values(inv.attributes).join(' ')}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [all, cold, release, attrs, search]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const inv of base) {
      counts[inv.status] = (counts[inv.status] ?? 0) + 1;
    }
    return counts;
  }, [base]);

  const filtered = useMemo(
    () =>
      base.filter(inv => {
        if (statuses.length && !statuses.includes(inv.status)) {
          return false;
        }
        if (selection) {
          return (
            inv.timestamp >= selection.minTime &&
            inv.timestamp < selection.maxTime &&
            inv.durationMs >= selection.minDuration &&
            inv.durationMs < selection.maxDuration
          );
        }
        return true;
      }),
    [base, statuses, selection]
  );

  const sorted = useMemo(() => {
    const key = sort?.replace(/^-/, '') ?? 'time';
    const dir = (sort?.startsWith('-') ?? true) ? -1 : 1;
    const value = (inv: Invocation) =>
      key === 'duration'
        ? inv.durationMs
        : key === 'memory'
          ? inv.memoryMb
          : key === 'billed'
            ? inv.billedMs
            : inv.timestamp;
    return filtered.slice().sort((a, b) => (value(a) - value(b)) * dir);
  }, [filtered, sort]);

  useEffect(() => setPage(0), [filtered]);

  const comparing = !!selection || statuses.length > 0;
  const comparison = useMemo(
    () =>
      comparing
        ? compareAttributes(
            filtered,
            base.filter(inv => !filtered.includes(inv)),
            statuses.length > 0
          )
        : [],
    [comparing, filtered, base, statuses]
  );

  // Reopen the drawer for a shared link once the data is there.
  const reopened = useRef(false);
  useEffect(() => {
    if (openId && !reopened.current && all.length) {
      reopened.current = true;
      const inv = all.find(i => i.id === openId);
      if (inv) {
        onOpen(inv);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);

  if (query.isPending) {
    return (
      <Stack gap="lg">
        <Placeholder height="32px" />
        <Placeholder height="250px" />
        <Placeholder height="420px" />
      </Stack>
    );
  }

  const headerSort = (key: string) => ({
    sort:
      (sort?.replace(/^-/, '') ?? 'time') === key
        ? (sort?.startsWith('-') ?? true)
          ? ('desc' as const)
          : ('asc' as const)
        : undefined,
    handleSortClick: () => setSort((sort ?? '-time') === `-${key}` ? key : `-${key}`),
  });

  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const releaseOptions = releasesOf(fn).map(r => ({
    value: r.release,
    label: `${r.release} (v${r.version})`,
  }));

  return (
    <Stack gap="lg">
      <Flex gap="sm" align="center" wrap="wrap">
        <SearchInput
          size="sm"
          placeholder={t('Search request ID, trace ID, error or attribute value')}
          defaultValue={search ?? ''}
          onChange={event => setSearch(event.target.value)}
        />
        <Flex gap="xs" wrap="wrap">
          {STATUSES.filter(
            status => statusCounts[status] || statuses.includes(status)
          ).map(status => {
            const active = statuses.includes(status);
            return (
              <Button
                key={status}
                size="xs"
                variant={active ? 'primary' : 'secondary'}
                onClick={() =>
                  setStatuses(
                    active ? statuses.filter(s => s !== status) : [...statuses, status]
                  )
                }
              >
                {`${STATUS_LABEL[status]} ${statusCounts[status] ?? 0}`}
              </Button>
            );
          })}
        </Flex>
        <Button
          size="xs"
          variant={cold === '1' ? 'primary' : 'secondary'}
          onClick={() => setCold(cold === '1' ? undefined : '1')}
        >
          {t('Cold starts only')}
        </Button>
        <CompactSelect
          clearable
          value={release}
          options={releaseOptions}
          onChange={option => setRelease(option?.value)}
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              size="xs"
              prefix={release ? t('Release') : undefined}
            >
              {release ?? t('Any release')}
            </OverlayTrigger.Button>
          )}
        />
        {attrs.map(attr => (
          <Tag
            key={attr}
            variant="info"
            onDismiss={() => setAttrs(attrs.filter(a => a !== attr))}
          >
            {attr}
          </Tag>
        ))}
      </Flex>

      <Container border="primary" radius="md" padding="md lg">
        <Stack gap="md">
          <Flex justify="between" align="start" wrap="wrap" gap="sm">
            <Stack gap="2xs">
              <Text bold>{t('Duration')}</Text>
              <Text size="xs" variant="muted">
                {t(
                  'All %s invocations, reported by the extension. Darker cells hold more invocations. Drag to select and compare.',
                  formatCount(
                    Math.round(
                      query.data!.heatmap.counts.flat().reduce((sum, c) => sum + c, 0)
                    )
                  )
                )}
              </Text>
            </Stack>
            <Flex gap="sm" align="center">
              {live && <PartialNote />}
              <Button
                size="xs"
                variant="transparent"
                icon={<IconExpand size="xs" />}
                aria-label={t('Open full screen')}
                tooltipProps={{title: t('Full screen')}}
                onClick={() =>
                  openInsightChartModal({
                    title: t('Duration · %s', fn.name),
                    fullscreen: true,
                    children: <HeatmapFullscreen fn={fn} />,
                  })
                }
              />
            </Flex>
            {selection && (
              <Flex gap="sm" align="center" width="100%" justify="end">
                <Text size="xs" variant="muted">
                  {t(
                    '%s–%s, %s sampled invocations',
                    formatMs(selection.minDuration),
                    formatMs(Math.min(selection.maxDuration, fn.timeoutS * 1000)),
                    filtered.length
                  )}
                </Text>
                <Button
                  size="xs"
                  icon={<IconClose />}
                  onClick={() => setSelectionParam(undefined)}
                >
                  {t('Clear selection')}
                </Button>
              </Flex>
            )}
          </Flex>
          <LatencyHeatmap
            data={query.data!.heatmap}
            timeoutMs={fn.timeoutS * 1000}
            releases={releasesOf(fn).map(r => ({
              timestamp: r.deployedAt,
              label: `v${r.version}`,
            }))}
            selection={selection}
            onSelect={next =>
              setSelectionParam(
                next
                  ? [
                      Math.round(next.minTime),
                      Math.round(next.maxTime),
                      Math.round(next.minDuration),
                      Math.round(next.maxDuration),
                    ].join(',')
                  : undefined
              )
            }
          />
        </Stack>
      </Container>

      {comparing && (
        <Container border="primary" radius="md" padding="md lg">
          <Stack gap="md">
            <SectionTitle source="spans">
              {tct('What’s different about these [count] invocations', {
                count: filtered.length,
              })}
            </SectionTitle>
            <Text size="xs" variant="muted">
              {t(
                'Share of each attribute value in the selection (yellow) vs. all other invocations (grey), most different first. Click a value to filter on it.'
              )}
            </Text>
            {comparison.length ? (
              <Grid columns={{xs: '1fr', lg: '1fr 1fr'}} gap="lg">
                {comparison.map(attr => (
                  <Stack key={attr.key} gap="xs">
                    <Flex gap="sm" align="center">
                      <Text size="sm" bold monospace>
                        {attr.key}
                      </Text>
                      <Text size="xs" variant="muted">
                        {t('%s points different', Math.round(attr.score * 100))}
                      </Text>
                    </Flex>
                    <ComparisonBars
                      rows={attr.rows}
                      onFilter={value =>
                        setAttrs([
                          ...attrs.filter(a => !a.startsWith(`${attr.key}=`)),
                          `${attr.key}=${value}`,
                        ])
                      }
                    />
                  </Stack>
                ))}
              </Grid>
            ) : (
              <Text size="sm" variant="muted">
                {t('Not enough invocations outside the selection to compare.')}
              </Text>
            )}
          </Stack>
        </Container>
      )}

      <InvocationTable
        fn={fn}
        rows={pageRows}
        openId={openId}
        fresh={fresh}
        onOpen={onOpen}
        timeFormat={
          window.end - window.start > 86_400_000 ? 'MMM D HH:mm:ss' : 'HH:mm:ss'
        }
        headerSort={headerSort}
      />
      {!pageRows.length && (
        <Container border="primary" radius="md" padding="xl">
          <Text variant="muted">{t('No sampled invocations match these filters.')}</Text>
        </Container>
      )}
      <Flex justify="between" align="center">
        <Text size="sm" variant="muted">
          {t(
            '%s–%s of %s',
            Math.min(sorted.length, page * PAGE_SIZE + 1),
            Math.min(sorted.length, (page + 1) * PAGE_SIZE),
            sorted.length.toLocaleString()
          )}
        </Text>
        <Flex gap="xs">
          <Button size="xs" disabled={page === 0} onClick={() => setPage(page - 1)}>
            {t('Previous')}
          </Button>
          <Button
            size="xs"
            disabled={(page + 1) * PAGE_SIZE >= sorted.length}
            onClick={() => setPage(page + 1)}
          >
            {t('Next')}
          </Button>
          <LinkButton
            size="xs"
            to={exploreUrl(
              organization,
              `span.op:function.aws faas.name:${fn.name}${statuses.length ? ` span.status:[${statuses.join(',')}]` : ''}`
            )}
          >
            {t('Open in Explore')}
          </LinkButton>
        </Flex>
      </Flex>
    </Stack>
  );
}

function InvocationTable({
  fn,
  rows,
  openId,
  fresh,
  onOpen,
  timeFormat,
  headerSort,
}: {
  fn: LambdaFunction;
  fresh: Set<string>;
  onOpen: Opener;
  rows: Invocation[];
  timeFormat: string;
  headerSort?: (key: string) => {
    handleSortClick: () => void;
    sort: 'asc' | 'desc' | undefined;
  };
  openId?: string;
}) {
  const sortable = (key: string) => headerSort?.(key) ?? {};
  return (
    <InvocationGrid>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell {...sortable('time')}>{t('Time')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Request ID')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Trigger')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Result')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell {...sortable('duration')}>
          {t('Duration')}
        </SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell {...sortable('billed')}>
          {t('Billed')}
        </SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell {...sortable('memory')}>
          {t('Memory')}
        </SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Release')}</SimpleTable.HeaderCell>
      </SimpleTable.Header>
      {rows.map(inv => (
        <ClickableRow
          key={inv.id}
          onClick={() => onOpen(inv)}
          active={inv.id === openId}
          fresh={fresh.has(inv.id)}
        >
          <SimpleTable.RowCell>
            <Text size="sm" tabular>
              {getFormattedDate(inv.timestamp, timeFormat)}
            </Text>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Text size="sm" monospace ellipsis>
              {inv.requestId}
            </Text>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Text size="sm" ellipsis>
              {inv.trigger}
            </Text>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Tooltip title={inv.errorType} disabled={!inv.errorType}>
              <Flex gap="xs">
                <StatusTag status={inv.status} />
                {inv.coldStart && <Tag variant="info">{t('Cold')}</Tag>}
              </Flex>
            </Tooltip>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell justify="end">
            <Text
              size="sm"
              tabular
              variant={inv.durationMs >= fn.timeoutS * 950 ? 'danger' : undefined}
            >
              {inv.status === 'throttled' ? '—' : formatMs(inv.durationMs)}
            </Text>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell justify="end">
            <Text size="sm" tabular>
              {inv.status === 'throttled' ? '—' : formatMs(inv.billedMs)}
            </Text>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell justify="end">
            <Text
              size="sm"
              tabular
              variant={inv.memoryMb >= fn.memoryMb ? 'danger' : undefined}
            >
              {inv.status === 'throttled' ? '—' : `${inv.memoryMb} MB`}
            </Text>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Text size="sm" monospace ellipsis>
              {inv.release}
            </Text>
          </SimpleTable.RowCell>
        </ClickableRow>
      ))}
    </InvocationGrid>
  );
}

function PartialNote() {
  return (
    <InfoText
      title={t('The last column is still filling up and changes on every refresh.')}
      size="xs"
      variant="muted"
    >
      {t('Last column partial')}
    </InfoText>
  );
}

const TAIL_POLL_MS = 1000;
const TAIL_MAX_ROWS = 500;

/**
 * Streams invocations like Datadog Live Search and Lumigo Live Tail: pause/resume, a rate counter,
 * a sampling notice above the display cap, and opening a row pauses the stream.
 */
function LiveTail({
  fn,
  onOpen,
  openId,
}: {
  fn: LambdaFunction;
  onOpen: Opener;
  openId?: string;
}) {
  const [rows, setRows] = useState<Invocation[]>(
    () => liveTail(fn, Date.now() - 60_000, Date.now()).invocations
  );
  const [pending, setPending] = useState<Invocation[]>([]);
  const [paused, setPaused] = useState(false);
  const [failuresOnly, setFailuresOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [perSecond, setPerSecond] = useState(0);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const startedAt = useRef(Date.now());
  const now = useNow();

  useEffect(() => {
    let last = Date.now();
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      const at = Date.now();
      const next = liveTail(fn, last, at);
      last = at;
      setPerSecond(next.perSecond);
      if (!next.invocations.length) {
        return;
      }
      if (pausedRef.current) {
        setPending(previous =>
          [...next.invocations, ...previous].slice(0, TAIL_MAX_ROWS)
        );
      } else {
        setRows(previous => [...next.invocations, ...previous].slice(0, TAIL_MAX_ROWS));
        setFresh(new Set(next.invocations.map(inv => inv.id)));
      }
    }, TAIL_POLL_MS);
    return () => clearInterval(id);
  }, [fn]);

  const resume = () => {
    setRows(previous => [...pending, ...previous].slice(0, TAIL_MAX_ROWS));
    setFresh(new Set(pending.map(inv => inv.id)));
    setPending([]);
    setPaused(false);
  };

  const q = search.toLowerCase();
  const visible = rows.filter(
    inv =>
      (!failuresOnly || inv.status !== 'ok') &&
      (!q ||
        `${inv.requestId} ${inv.traceId} ${inv.trigger} ${inv.errorType ?? ''} ${Object.values(inv.attributes).join(' ')}`
          .toLowerCase()
          .includes(q))
  );
  const failures = rows.filter(inv => inv.status !== 'ok').length;
  const sampled = perSecond > LIVE_TAIL_MAX_PER_SECOND;
  const elapsed = Math.round((now - startedAt.current) / 1000);

  return (
    <Stack gap="md">
      <Flex gap="sm" align="center" wrap="wrap">
        {paused ? (
          <Button
            size="xs"
            variant="primary"
            icon={<IconPlay size="xs" />}
            onClick={resume}
          >
            {pending.length ? t('Resume · %s new', pending.length) : t('Resume')}
          </Button>
        ) : (
          <Button
            size="xs"
            icon={<IconPause size="xs" />}
            onClick={() => setPaused(true)}
          >
            {t('Pause')}
          </Button>
        )}
        <Button size="xs" onClick={() => setRows([])}>
          {t('Clear')}
        </Button>
        <SearchInput
          size="xs"
          placeholder={t('Filter request ID, error or attribute')}
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
        <Button
          size="xs"
          variant={failuresOnly ? 'primary' : 'secondary'}
          onClick={() => setFailuresOnly(!failuresOnly)}
        >
          {t('Failures only · %s', failures)}
        </Button>
        <Flex flex="1" justify="end" gap="md" align="center">
          <StatusDot active={!paused} />
          <Text size="xs" variant="muted" tabular>
            {paused ? t('Paused') : t('Streaming')} ·{' '}
            {t(
              '%s invocations/s',
              perSecond < 10 ? perSecond.toFixed(1) : Math.round(perSecond)
            )}{' '}
            ·{' '}
            {elapsed < 60
              ? `${elapsed}s`
              : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`}
          </Text>
          {sampled && (
            <Tooltip
              title={t(
                'Above %s invocations per second the stream shows a random sample. Failures in the sample are representative of all traffic; use the time range view for exact counts.',
                LIVE_TAIL_MAX_PER_SECOND
              )}
            >
              <Tag variant="warning">
                {t(
                  'Showing %s%%',
                  Math.round((LIVE_TAIL_MAX_PER_SECOND / perSecond) * 100)
                )}
              </Tag>
            </Tooltip>
          )}
        </Flex>
      </Flex>
      <InvocationTable
        fn={fn}
        rows={visible.slice(0, 200)}
        openId={openId}
        fresh={fresh}
        timeFormat="HH:mm:ss.SSS"
        onOpen={inv => {
          setPaused(true);
          onOpen(inv);
        }}
      />
      {!visible.length && (
        <Container border="primary" radius="md" padding="xl">
          <Text variant="muted">
            {rows.length
              ? t('No invocations match the filter yet.')
              : t('Waiting for invocations…')}
          </Text>
        </Container>
      )}
    </Stack>
  );
}

const StatusDot = styled('span')<{active: boolean}>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${p =>
    p.active
      ? p.theme.tokens.graphics.success.vibrant
      : p.theme.tokens.graphics.neutral.moderate};
  animation: ${p => (p.active ? 'lambda-pulse 1.6s ease-in-out infinite' : 'none')};
`;

/** The duration heatmap at full screen, with the page's time picker; selections carry back to the page. */
function HeatmapFullscreen({fn}: {fn: LambdaFunction}) {
  const {window} = useLambdaWindow();
  const [selectionParam, setSelectionParam] = useUrlState('sel');
  const data = useMemo(() => durationHeatmap(fn, window), [fn, window]);
  return (
    <Stack gap="md">
      <Flex gap="sm" align="center">
        <PageFilterBar>
          <DatePageFilter />
        </PageFilterBar>
        <Text size="xs" variant="muted">
          {t(
            'Drag to select a region; the invocations tab compares it with everything else when you close this view.'
          )}
        </Text>
      </Flex>
      <LatencyHeatmap
        data={data}
        height={Math.max(360, Math.round(document.documentElement.clientHeight * 0.68))}
        timeoutMs={fn.timeoutS * 1000}
        releases={releasesOf(fn).map(r => ({
          timestamp: r.deployedAt,
          label: `v${r.version}`,
        }))}
        selection={parseSelection(selectionParam)}
        onSelect={next =>
          setSelectionParam(
            next
              ? [
                  Math.round(next.minTime),
                  Math.round(next.maxTime),
                  Math.round(next.minDuration),
                  Math.round(next.maxDuration),
                ].join(',')
              : undefined
          )
        }
      />
    </Stack>
  );
}

interface AttributeComparison {
  key: string;
  rows: Array<{baseline: number; selection: number; value: string}>;
  score: number;
}

/** BubbleUp-style comparison: which attribute values are over-represented in the selection. */
function compareAttributes(
  selection: Invocation[],
  baseline: Invocation[],
  excludeStatus: boolean
): AttributeComparison[] {
  if (!selection.length || baseline.length < 5) {
    return [];
  }
  const keys = new Set<string>();
  for (const inv of [...selection, ...baseline]) {
    Object.keys(inv.attributes).forEach(key => keys.add(key));
  }
  const share = (list: Invocation[], key: string) => {
    const counts = new Map<string, number>();
    for (const inv of list) {
      const value = inv.attributes[key] ?? '(none)';
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return new Map(
      [...counts.entries()].map(([value, count]) => [value, count / list.length])
    );
  };
  const out: AttributeComparison[] = [];
  for (const key of keys) {
    if (
      (excludeStatus && key === 'status') ||
      key === 'messaging.destination.name' ||
      key === 'faas.document.collection'
    ) {
      continue;
    }
    const sel = share(selection, key);
    const base = share(baseline, key);
    const values = new Set([...sel.keys(), ...base.keys()]);
    if (values.size > 12) {
      continue;
    }
    const rows = [...values].map(value => ({
      value,
      selection: sel.get(value) ?? 0,
      baseline: base.get(value) ?? 0,
    }));
    const score = Math.max(...rows.map(row => Math.abs(row.selection - row.baseline)));
    out.push({
      key,
      score,
      rows: rows
        .sort((a, b) => b.selection - b.baseline - (a.selection - a.baseline))
        .slice(0, 4),
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 4);
}

type DrawerTab = 'trace' | 'logs' | 'payload' | 'environment' | 'attributes';

function InvocationDrawer({
  fn,
  invocation,
  organizationSlug,
}: {
  fn: LambdaFunction;
  invocation: Invocation;
  organizationSlug: string;
}) {
  const [tab, setTab] = useState<DrawerTab>('trace');
  const payload = payloadFor(fn, invocation);
  const lines = logsFor(fn, invocation);
  const facts: Array<[string, string]> = [
    [t('Time'), getFormattedDate(invocation.timestamp, 'MMM D, HH:mm:ss.SSS')],
    [
      t('Duration'),
      invocation.status === 'throttled' ? '—' : formatMs(invocation.durationMs),
    ],
    [
      t('Billed'),
      invocation.status === 'throttled' ? '—' : formatMs(invocation.billedMs),
    ],
    [t('Init'), invocation.initMs ? formatMs(invocation.initMs) : t('warm')],
    [
      t('Memory'),
      invocation.status === 'throttled'
        ? '—'
        : `${invocation.memoryMb} / ${fn.memoryMb} MB`,
    ],
    [t('Release'), `${invocation.release} (v${invocation.version})`],
  ];
  return (
    <Stack height="100%">
      <DrawerHeader>
        <Flex justify="between" align="center" width="100%" gap="md">
          <Flex gap="sm" align="center" minWidth="0">
            <Text bold ellipsis>
              {fn.name}
            </Text>
            <StatusTag status={invocation.status} />
            {invocation.coldStart && <Tag variant="info">{t('Cold start')}</Tag>}
          </Flex>
        </Flex>
      </DrawerHeader>
      <DrawerBody>
        <Stack gap="lg">
          <Stack gap="xs">
            <Text size="xs" variant="muted" monospace>
              {t('request')} {invocation.requestId}
            </Text>
            <Text size="xs" variant="muted" monospace>
              {t('trace')} {invocation.traceId}
            </Text>
            {invocation.errorType && (
              <Text size="sm" variant="danger" bold>
                {invocation.errorType}
              </Text>
            )}
          </Stack>
          <Grid columns="repeat(3, 1fr)" gap="sm">
            {facts.map(([label, value]) => (
              <Container key={label} border="primary" radius="md" padding="sm md">
                <Stack gap="0">
                  <Text size="xs" variant="muted">
                    {label}
                  </Text>
                  <Text size="sm" bold tabular>
                    {value}
                  </Text>
                </Stack>
              </Container>
            ))}
          </Grid>
          {invocation.status === 'timeout' && (
            <Text size="sm">
              {t(
                'The runtime was killed at the deadline, so the SDK could not finish this transaction. The Sentry extension got SHUTDOWN(timeout), closed the function.aws span with status deadline_exceeded and sent a TimeoutError linked to this trace. Spans still open at the deadline are shown as unfinished.'
              )}
            </Text>
          )}
          {invocation.status === 'oom' && (
            <Text size="sm">
              {t(
                'Lambda killed the runtime for exceeding its memory limit. Only the extension survives this, so it closed the span and reported the issue.'
              )}
            </Text>
          )}
          {invocation.status === 'throttled' && (
            <Text size="sm">
              {t(
                'This invocation never ran: Lambda rejected it at the reserved concurrency limit. Throttles come from the AWS integration; SNS retries async invocations before dropping them.'
              )}
            </Text>
          )}
          {invocation.errorType &&
            invocation.status !== 'oom' &&
            invocation.status !== 'throttled' && (
              <ErrorBlock fn={fn} invocation={invocation} />
            )}
          <SegmentedControl<DrawerTab>
            size="xs"
            aria-label={t('Invocation details')}
            value={tab}
            onChange={setTab}
          >
            <SegmentedControl.Item key="trace">{t('Trace')}</SegmentedControl.Item>
            <SegmentedControl.Item key="logs">
              {t('Logs (%s)', lines.length)}
            </SegmentedControl.Item>
            <SegmentedControl.Item key="payload">{t('Payload')}</SegmentedControl.Item>
            <SegmentedControl.Item key="environment">
              {t('Environment')}
            </SegmentedControl.Item>
            <SegmentedControl.Item key="attributes">
              {t('Attributes')}
            </SegmentedControl.Item>
          </SegmentedControl>
          {tab === 'trace' &&
            (invocation.status === 'throttled' ? (
              <Text variant="muted">{t('No trace: the function never ran.')}</Text>
            ) : (
              <Stack gap="sm">
                <TraceWaterfall spans={traceSpans(fn, invocation)} />
                <Flex>
                  <LinkButton
                    size="xs"
                    icon={<IconOpen />}
                    to={`/organizations/${organizationSlug}/explore/traces/?query=${encodeURIComponent(`trace:${invocation.traceId}`)}`}
                  >
                    {t('Open full trace')}
                  </LinkButton>
                </Flex>
              </Stack>
            ))}
          {tab === 'logs' && (
            <Container border="primary" radius="md" overflow="hidden">
              {lines.map(line => (
                <DrawerLogRow key={line.id} level={line.level}>
                  <Text size="xs" monospace variant="muted">
                    {getFormattedDate(line.timestamp, 'HH:mm:ss.SSS')}
                  </Text>
                  <Tag variant={line.source === 'logging' ? 'info' : 'muted'}>
                    {line.source}
                  </Tag>
                  <Text
                    size="xs"
                    monospace
                    wordBreak="break-all"
                    variant={line.level === 'error' ? 'danger' : undefined}
                  >
                    {line.message}
                  </Text>
                </DrawerLogRow>
              ))}
            </Container>
          )}
          {tab === 'payload' && (
            <Stack gap="sm">
              <Text size="xs" variant="muted">
                {t(
                  'Captured by the SDK. Secrets, cookies, IPs and database images are filtered before they leave the function.'
                )}
              </Text>
              <Text size="sm" bold>
                {t('Event')}
              </Text>
              <CodeBlock language="json">
                {JSON.stringify(payload.event, null, 2)}
              </CodeBlock>
              <Text size="sm" bold>
                {t('Response')}
              </Text>
              <CodeBlock language="json">
                {JSON.stringify(payload.response, null, 2)}
              </CodeBlock>
            </Stack>
          )}
          {tab === 'environment' && <EnvironmentTable fn={fn} invocation={invocation} />}
          {tab === 'attributes' && (
            <Container border="primary" radius="md" overflow="hidden">
              {Object.entries({
                'faas.name': fn.name,
                'faas.invocation_id': invocation.requestId,
                'faas.trigger': fn.triggers[0]!.faasTrigger,
                'cloud.region': fn.region,
                'aws.lambda.invoked_arn': `arn:aws:lambda:${fn.region}:${fn.account}:function:${fn.name}`,
                ...invocation.attributes,
              }).map(([key, value]) => (
                <AttrRow key={key}>
                  <Text size="xs" monospace variant="muted">
                    {key}
                  </Text>
                  <Text size="xs" monospace>
                    {value}
                  </Text>
                </AttrRow>
              ))}
            </Container>
          )}
        </Stack>
      </DrawerBody>
    </Stack>
  );
}

/** The exception and its traceback, in-app frames first-class like an issue's stack trace. */
function ErrorBlock({fn, invocation}: {fn: LambdaFunction; invocation: Invocation}) {
  const [showAll, setShowAll] = useState(false);
  const frames = stackFor(fn, invocation);
  const [type, ...message] = (
    invocation.status === 'timeout'
      ? `ServerlessTimeoutWarning: ${invocation.errorType}`
      : invocation.errorType!
  ).split(': ');
  const shown = showAll
    ? frames
    : frames.filter(frame => frame.inApp || frame === frames[frames.length - 1]);
  return (
    <Container border="danger" radius="md" overflow="hidden">
      <Stack gap="xs" padding="sm md">
        <Text size="sm" bold variant="danger">
          {type}
        </Text>
        <Text size="xs" monospace wordBreak="break-all">
          {message.join(': ')}
        </Text>
      </Stack>
      {[...shown].reverse().map((frame, i) => (
        <FrameRow key={`${frame.file}-${frame.line}-${i}`} inApp={frame.inApp}>
          <Text size="xs" monospace variant={frame.inApp ? undefined : 'muted'}>
            {frame.file}
            {frame.line ? `:${frame.line}` : ''} {t('in')}{' '}
            <Text size="xs" monospace bold={frame.inApp}>
              {frame.function}
            </Text>
          </Text>
          {frame.context && (
            <Text size="xs" monospace variant="muted" ellipsis>
              {frame.context}
            </Text>
          )}
        </FrameRow>
      ))}
      <Flex padding="xs md" justify="between" align="center">
        <Button size="zero" variant="link" onClick={() => setShowAll(!showAll)}>
          {showAll
            ? t('Show in-app frames only')
            : t('Show all %s frames', frames.length)}
        </Button>
        <Text size="xs" variant="muted">
          {invocation.status === 'timeout'
            ? t(
                'Stack captured by the SDK’s timeout warning, before the runtime was killed'
              )
            : t('Most recent call first')}
        </Text>
      </Flex>
    </Container>
  );
}

const FrameRow = styled('div')<{inApp: boolean}>`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  border-left: 3px solid
    ${p => (p.inApp ? p.theme.tokens.graphics.danger.vibrant : 'transparent')};
`;

/** The execution environment and configuration this invocation ran with. */
function EnvironmentTable({
  fn,
  invocation,
}: {
  fn: LambdaFunction;
  invocation: Invocation;
}) {
  const environment =
    invocation.attributes['faas.instance'] ??
    `${getFormattedDate(invocation.timestamp, 'YYYY/MM/DD')}/[${invocation.version}]${invocation.traceId.slice(0, 32)}`;
  const rows: Array<[string, string]> = [
    ['AWS_LAMBDA_LOG_STREAM_NAME', environment],
    [
      'AWS_LAMBDA_INITIALIZATION_TYPE',
      fn.provisionedConcurrency ? 'provisioned-concurrency' : 'on-demand',
    ],
    [
      t('Started by'),
      invocation.coldStart
        ? t(
            'this invocation (cold start, init %s)',
            formatMs(invocation.initMs ?? fn.initP50Ms)
          )
        : t('an earlier invocation (warm)'),
    ],
    [t('Version'), `${invocation.version} (${invocation.release})`],
    [t('Runtime'), `${fn.runtime} · ${fn.arch}`],
    [t('Handler'), fn.handler],
    [t('Memory / timeout'), `${fn.memoryMb} MB / ${fn.timeoutS}s`],
    [
      t('Layers'),
      [fn.sdkLayer, fn.extensionLayer].filter(Boolean).join(', ') || t('none'),
    ],
    ['SENTRY_RELEASE', invocation.release],
    ['SENTRY_ENVIRONMENT', fn.env],
    ['SENTRY_TRACES_SAMPLE_RATE', '0.2'],
    ['SENTRY_DSN', 'https://••••@o4511773493493760.ingest.de.sentry.io/4512089988857936'],
  ];
  return (
    <Container border="primary" radius="md" overflow="hidden">
      {rows.map(([key, value]) => (
        <AttrRow key={key}>
          <Text size="xs" monospace variant="muted">
            {key}
          </Text>
          <Text size="xs" monospace wordBreak="break-all">
            {value}
          </Text>
        </AttrRow>
      ))}
    </Container>
  );
}

const SearchInput = styled(Input)`
  max-width: 380px;
`;

const InvocationGrid = styled(SimpleTable)`
  grid-template-columns: max-content minmax(140px, 1fr) minmax(
      150px,
      1.3fr
    ) max-content repeat(3, max-content) max-content;
`;

const ClickableRow = styled(SimpleTable.Row, {
  shouldForwardProp: prop => !['active', 'fresh'].includes(prop),
})<{active: boolean; fresh: boolean}>`
  cursor: pointer;
  animation: ${p => (p.fresh ? 'lambda-flash 2.5s ease-out' : 'none')};

  @keyframes lambda-flash {
    from {
      background: ${p => p.theme.tokens.background.transparent.accent.muted};
    }
    to {
      background: transparent;
    }
  }

  background: ${p => (p.active ? p.theme.tokens.background.secondary : 'transparent')};
  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

const DrawerLogRow = styled('div')<{level: 'info' | 'warn' | 'error'}>`
  display: grid;
  grid-template-columns: 90px max-content minmax(0, 1fr);
  gap: ${p => p.theme.space.sm};
  align-items: center;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  border-left: 3px solid
    ${p =>
      p.level === 'error'
        ? p.theme.tokens.graphics.danger.vibrant
        : p.level === 'warn'
          ? p.theme.tokens.graphics.warning.vibrant
          : 'transparent'};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const AttrRow = styled('div')`
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;
