import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Slider} from '@sentry/scraps/slider';
import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct} from 'sentry/locale';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {Histogram} from 'sentry/views/insights/awsLambda/charts';
import {
  ChartWidget,
  DistributionWidget,
  formatCount,
  formatMs,
  formatPct,
  formatUsd,
  Kpi,
  KpiRow,
  limitLine,
  openApplyMemory,
  SectionTitle,
  STAT_LABEL,
  useStatColors,
} from 'sentry/views/insights/awsLambda/components';
import {
  coldStartRateSeries,
  coldStartRate,
  DAY,
  failureRate,
  HOUR,
  imports,
  type Invocation,
  invocations,
  type LambdaFunction,
  makeWindow,
  MEMORY_OPTIONS,
  memoryLimitSeries,
  metricSeries,
  releasesOf,
  rightSizing,
  type TimeWindow,
  totals,
} from 'sentry/views/insights/awsLambda/mockData';

function percentile(values: number[], p: number) {
  if (!values.length) {
    return 0;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

/** Equal-width bins from `min` (default: just below the smallest value) to `max`. */
function bins(values: number[], count: number, max?: number, min?: number) {
  const top = max ?? Math.max(1, ...values);
  const lo = min ?? Math.max(0, Math.min(...values) - (top - Math.min(...values)) * 0.1);
  const size = (top - lo) / count || 1;
  const out = Array.from({length: count}, (_, i) => ({
    from: lo + i * size,
    to: lo + (i + 1) * size,
    count: 0,
  }));
  for (const value of values) {
    out[Math.min(count - 1, Math.max(0, Math.floor((value - lo) / size)))]!.count++;
  }
  return out;
}

// Cold starts

// Provisioned concurrency price per GB-second (first tier).
const PC_PRICE = {arm64: 0.0000033334, x86_64: 0.0000041667};

export function ColdStartsTab({
  fn,
  window,
  previous,
}: {
  fn: LambdaFunction;
  previous: TimeWindow;
  window: TimeWindow;
}) {
  const t0 = totals([fn], window);
  const before = totals([fn], previous);
  const sampled = invocations(fn, window);
  const inits = sampled.filter(inv => inv.initMs).map(inv => inv.initMs!);
  const [pc, setPc] = useState(fn.provisionedConcurrency ?? 0);

  const byHour = useMemo(() => {
    const total = Array.from({length: 24}, () => 0);
    const cold = Array.from({length: 24}, () => 0);
    for (const inv of sampled) {
      const hour = new Date(inv.timestamp).getHours();
      total[hour]!++;
      if (inv.coldStart) {
        cold[hour]!++;
      }
    }
    return total.map((n, hour) => ({
      from: hour,
      to: hour + 1,
      count: n ? Math.round((cold[hour]! / n) * 1000) / 10 : 0,
    }));
  }, [sampled]);

  const peak = Math.max(1, t0.concurrency);
  const coverage = Math.min(1, pc / peak);
  const avoided = Math.round(t0.coldStarts * coverage ** 0.7);
  const pcMonthly = pc * (fn.memoryMb / 1024) * 3600 * 24 * 30 * PC_PRICE[fn.arch];
  const rows = imports(fn);

  return (
    <Stack gap="xl" paddingTop="lg">
      <KpiRow>
        <Kpi
          label={t('Cold start rate')}
          value={formatPct(coldStartRate(t0))}
          current={coldStartRate(t0)}
          previous={coldStartRate(before)}
          series={metricSeries([fn], 'coldStarts', window).values.map(v => v.value)}
          detail={t('%s cold starts', formatCount(t0.coldStarts))}
        />
        <Kpi
          label={t('Init p50')}
          value={formatMs(percentile(inits, 0.5) || fn.initP50Ms)}
          detail={t('from %s sampled cold starts', inits.length)}
        />
        <Kpi
          label={t('Init p95')}
          value={formatMs(t0.initP95)}
          current={t0.initP95}
          previous={before.initP95}
          series={metricSeries([fn], 'initP95', window).values.map(v => v.value)}
          detail={t('includes runtime start')}
        />
        <Kpi
          label={t('Proactive inits')}
          value={formatCount(t0.coldStarts * 0.08)}
          polarity="neutral"
          detail={t('ahead of demand, not cold starts')}
        />
        <Kpi
          label={t('Provisioned')}
          value={fn.provisionedConcurrency ? `${fn.provisionedConcurrency}` : '—'}
          detail={
            t0.pcUtilization === null
              ? t('not configured')
              : t('peak %s used', formatPct(t0.pcUtilization, 0))
          }
        />
      </KpiRow>

      <Grid columns={{xs: '1fr', lg: '1fr 1fr'}} gap="md">
        <ChartWidget
          title={t('Cold start rate')}
          source="extension"
          description={t(
            'Share of invocations that started a new execution environment.'
          )}
          note={t(
            '%s of %s invocations were cold',
            formatCount(t0.coldStarts),
            formatCount(t0.invocations)
          )}
          window={window}
          releasesFor={[fn]}
          plottables={w => [
            new Line(coldStartRateSeries(fn, w), {alias: t('cold start rate')}),
          ]}
        />
        <ChartWidget
          title={t('Init duration p95')}
          source="extension"
          note={t('Init p95 %s, added to every cold start', formatMs(t0.initP95))}
          window={window}
          releasesFor={[fn]}
          plottables={w => [
            new Line(metricSeries([fn], 'initP95', w), {alias: t('init p95')}),
          ]}
        />
      </Grid>

      <Grid columns={{xs: '1fr', lg: '1fr 1fr'}} gap="md">
        <DistributionWidget
          title={t('Init duration distribution')}
          source="extension"
          bins={inits.length ? bins(inits, 16) : []}
          formatX={formatMs}
          unit={t('cold starts')}
          emptyMessage={t('No sampled cold starts in this time range.')}
          markers={[
            {
              label: `p50 ${formatMs(percentile(inits, 0.5))}`,
              value: percentile(inits, 0.5),
              variant: 'accent',
            },
            {
              label: `p95 ${formatMs(percentile(inits, 0.95))}`,
              value: percentile(inits, 0.95),
              variant: 'warning',
            },
          ]}
        />
        <DistributionWidget
          title={t('Cold start rate by hour of day (%)')}
          source="spans"
          bins={byHour.map(bin => ({
            ...bin,
            highlight: bin.count > coldStartRate(t0) * 150,
          }))}
          formatX={value => `${Math.round(value)}:00`}
          formatY={value => `${value}%`}
          unit={t('cold start rate')}
          footer={
            <Text size="xs" variant="muted">
              {t(
                'Highlighted hours are when traffic ramps up and Lambda starts new environments.'
              )}
            </Text>
          }
        />
      </Grid>

      <Grid columns={{xs: '1fr', lg: '3fr 2fr'}} gap="md">
        <Stack gap="md">
          <SectionTitle source="spans">{t('What init spends its time on')}</SectionTitle>
          <ImportsGrid>
            <SimpleTable.Header>
              <SimpleTable.HeaderCell>{t('Module')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('From')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('p50')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Share of init')}</SimpleTable.HeaderCell>
            </SimpleTable.Header>
            {rows.map(row => (
              <SimpleTable.Row key={row.module}>
                <SimpleTable.RowCell>
                  <Flex gap="sm" align="center">
                    <Text monospace>{row.module}</Text>
                    {row.module === 'pandas' && (
                      <Tag variant="warning">{t('only used by /export')}</Tag>
                    )}
                  </Flex>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <Tag variant="muted">{row.from}</Tag>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell justify="end">
                  <Text tabular>{formatMs(row.p50Ms)}</Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <ShareBar ratio={row.share} />
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            ))}
          </ImportsGrid>
          <Text size="xs" variant="muted">
            {t(
              'From function.aws.import spans (imports of at least 3 ms during init). The total init time comes from the extension, because it includes the runtime start the SDK can’t see.'
            )}
          </Text>
        </Stack>
        <Container border="primary" radius="md" padding="lg">
          <Stack gap="md">
            <SectionTitle source="aws">
              {t('What if: provisioned concurrency')}
            </SectionTitle>
            <Slider
              min={0}
              max={Math.max(20, Math.ceil(peak * 1.5))}
              step={1}
              value={pc}
              onChange={value => setPc(Number(value))}
              formatOptions="hidden"
            />
            <Grid columns="1fr 1fr" gap="sm">
              <Fact label={t('Provisioned environments')} value={String(pc)} />
              <Fact label={t('Peak concurrency')} value={formatCount(peak)} />
              <Fact
                label={t('Cold starts avoided')}
                value={t(
                  '~%s (%s)',
                  formatCount(avoided),
                  formatPct(avoided / Math.max(1, t0.coldStarts), 0)
                )}
              />
              <Fact label={t('Extra cost per month')} value={formatUsd(pcMonthly)} />
            </Grid>
            <Text size="xs" variant="muted">
              {t(
                'Estimate from the peak concurrency in this period. Scheduling provisioned concurrency for the morning ramp only costs about a third of this.'
              )}
            </Text>
          </Stack>
        </Container>
      </Grid>
    </Stack>
  );
}

// Memory & cost

export function CostTab({
  fn,
  window,
  previous,
}: {
  fn: LambdaFunction;
  previous: TimeWindow;
  window: TimeWindow;
}) {
  const theme = useTheme();
  const t0 = totals([fn], window);
  const before = totals([fn], previous);
  const sampled = invocations(fn, window).filter(inv => inv.status !== 'throttled');
  const options = rightSizing(fn, t0);
  const spanDays = (window.end - window.start) / DAY;
  const monthly = (cost: number) => (cost / Math.max(spanDays, 1 / 24)) * 30;
  const current = options.find(o => o.current) ?? options[0]!;
  const recommended =
    options
      .filter(o => !o.oomRisk && !o.timeoutRisk && o.p95 <= current.p95 * 1.1)
      .sort((a, b) => a.cost - b.cost)[0] ??
    options.filter(o => !o.oomRisk).sort((a, b) => a.p95 - b.p95)[0] ??
    current;
  const [selectedIndex, setSelectedIndex] = useState(() =>
    MEMORY_OPTIONS.indexOf(recommended.memoryMb)
  );
  const selected = options[selectedIndex] ?? recommended;
  const memories = sampled.map(inv => inv.memoryMb);
  const extensionShare = fn.extensionLayer
    ? t0.postRuntime / Math.max(1, t0.p50 * 1.3 + t0.postRuntime)
    : 0;

  return (
    <Stack gap="xl" paddingTop="lg">
      <KpiRow>
        <Kpi
          label={t('Cost in period')}
          value={formatUsd(t0.cost)}
          current={t0.cost}
          previous={before.cost}
          series={metricSeries([fn], 'cost', window).values.map(v => v.value)}
          detail={t('~%s per month', formatUsd(monthly(t0.cost)))}
        />
        <Kpi
          label={t('Per 1M invocations')}
          value={formatUsd((t0.cost / Math.max(1, t0.invocations)) * 1e6)}
          detail={t('compute + requests')}
        />
        <Kpi
          label={t('Max memory used')}
          value={`${Math.round(t0.memory)} MB`}
          current={t0.memory}
          previous={before.memory}
          variant={
            t0.memory / fn.memoryMb >= 0.95
              ? 'danger'
              : t0.memory / fn.memoryMb < 0.25
                ? 'warning'
                : undefined
          }
          detail={t(
            '%s of %s MB configured',
            formatPct(t0.memory / fn.memoryMb, 0),
            fn.memoryMb
          )}
        />
        <Kpi
          label={t('Extension overhead')}
          value={fn.extensionLayer ? formatMs(t0.postRuntime) : '—'}
          detail={
            fn.extensionLayer
              ? t('%s of billed time, after the response', formatPct(extensionShare, 1))
              : t('no extension')
          }
        />
      </KpiRow>

      <Grid columns={{xs: '1fr', lg: '1fr 1fr'}} gap="md">
        <ChartWidget
          title={t('Estimated cost')}
          source="extension"
          window={window}
          releasesFor={[fn]}
          plottables={w => [new Bars(metricSeries([fn], 'cost', w), {alias: t('cost')})]}
        />
        <ChartWidget
          title={t('Memory used vs configured')}
          source="extension"
          window={window}
          releasesFor={[fn]}
          plottables={w => [
            new Line(metricSeries([fn], 'memory', w), {
              alias: t('max used'),
              color: theme.tokens.graphics.accent.vibrant,
            }),
            limitLine(
              memoryLimitSeries(fn, w, t('configured')),
              t('configured'),
              theme.tokens.graphics.neutral.moderate
            ),
          ]}
        />
      </Grid>

      <Container border="primary" radius="md" padding="lg">
        <Stack gap="lg">
          <SectionTitle source="extension">{t('Right-size memory')}</SectionTitle>
          <Text size="sm" variant="muted">
            {t(
              'Estimated from this function’s own duration and memory data: CPU scales with memory up to 1,769 MB (one vCPU), and %s of its time is CPU-bound. Compare sizes before changing them.',
              formatPct(fn.cpuShare, 0)
            )}
          </Text>
          <Grid columns={{xs: '1fr', lg: '2fr 3fr'}} gap="xl">
            <Stack gap="md">
              <Slider
                min={0}
                max={MEMORY_OPTIONS.length - 1}
                step={1}
                value={selectedIndex}
                onChange={value => setSelectedIndex(Number(value))}
                formatOptions="hidden"
              />
              <Flex justify="between">
                <Text size="xs" variant="muted">
                  128 MB
                </Text>
                <Text size="lg" bold>
                  {selected.memoryMb} MB
                </Text>
                <Text size="xs" variant="muted">
                  3008 MB
                </Text>
              </Flex>
              <Grid columns="1fr 1fr" gap="sm">
                <Fact
                  label={t('Duration p50')}
                  value={formatMs(selected.p50)}
                  delta={(selected.p50 - current.p50) / current.p50}
                />
                <Fact
                  label={t('Duration p95')}
                  value={formatMs(selected.p95)}
                  delta={(selected.p95 - current.p95) / current.p95}
                />
                <Fact
                  label={t('Cost per month')}
                  value={formatUsd(monthly(selected.cost))}
                  delta={(selected.cost - current.cost) / current.cost}
                />
                <Fact
                  label={t('Memory headroom')}
                  value={formatPct(Math.max(0, 1 - t0.memory / selected.memoryMb), 0)}
                />
              </Grid>
              <Flex gap="xs" wrap="wrap">
                {selected.current && <Tag variant="muted">{t('Current')}</Tag>}
                {selected.memoryMb === recommended.memoryMb && (
                  <Tag variant="success">{t('Recommended')}</Tag>
                )}
                {selected.oomRisk && (
                  <Tag variant="danger">{t('Out-of-memory risk')}</Tag>
                )}
                {selected.timeoutRisk && <Tag variant="danger">{t('Timeout risk')}</Tag>}
              </Flex>
              {!selected.current && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => openApplyMemory(fn, selected.memoryMb)}
                >
                  {t('Apply %s MB', selected.memoryMb)}
                </Button>
              )}
            </Stack>
            <SizingGrid>
              <SimpleTable.Header>
                <SimpleTable.HeaderCell>{t('Memory')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>{t('p50')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>{t('p95')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>{t('Per month')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>{t('vs current')}</SimpleTable.HeaderCell>
              </SimpleTable.Header>
              {options.map((option, index) => (
                <SizingRow
                  key={option.memoryMb}
                  selected={index === selectedIndex}
                  onClick={() => setSelectedIndex(index)}
                >
                  <SimpleTable.RowCell>
                    <Flex gap="xs" align="center">
                      <Text bold={option.current} tabular>
                        {option.memoryMb} MB
                      </Text>
                      {option.current && <Tag variant="muted">{t('now')}</Tag>}
                      {option.memoryMb === recommended.memoryMb && (
                        <Tag variant="success">{t('best')}</Tag>
                      )}
                      {option.oomRisk && <Tag variant="danger">{t('OOM')}</Tag>}
                    </Flex>
                  </SimpleTable.RowCell>
                  <SimpleTable.RowCell justify="end">
                    <Text size="sm" tabular>
                      {formatMs(option.p50)}
                    </Text>
                  </SimpleTable.RowCell>
                  <SimpleTable.RowCell justify="end">
                    <Text
                      size="sm"
                      tabular
                      variant={option.timeoutRisk ? 'danger' : undefined}
                    >
                      {formatMs(option.p95)}
                    </Text>
                  </SimpleTable.RowCell>
                  <SimpleTable.RowCell justify="end">
                    <Text size="sm" tabular>
                      {formatUsd(monthly(option.cost))}
                    </Text>
                  </SimpleTable.RowCell>
                  <SimpleTable.RowCell justify="end">
                    <Text
                      size="sm"
                      tabular
                      variant={
                        option.cost < current.cost * 0.97
                          ? 'success'
                          : option.cost > current.cost * 1.03
                            ? 'danger'
                            : 'muted'
                      }
                    >
                      {option.current
                        ? '—'
                        : `${option.cost < current.cost ? '−' : '+'}${formatPct(Math.abs(option.cost - current.cost) / current.cost, 0)}`}
                    </Text>
                  </SimpleTable.RowCell>
                </SizingRow>
              ))}
            </SizingGrid>
          </Grid>
        </Stack>
      </Container>

      <DistributionWidget
        title={t('Memory used per invocation')}
        source="extension"
        bins={bins(memories, 20, fn.memoryMb, 0)}
        formatX={value => `${Math.round(value)} MB`}
        markers={[
          {
            label: t('p99 %s MB', Math.round(percentile(memories, 0.99))),
            value: percentile(memories, 0.99),
            variant: 'warning',
          },
          {label: t('limit %s MB', fn.memoryMb), value: fn.memoryMb, variant: 'danger'},
        ]}
      />
    </Stack>
  );
}

function Fact({label, value, delta}: {label: string; value: string; delta?: number}) {
  return (
    <Container border="primary" radius="md" padding="sm md">
      <Text size="xs" variant="muted">
        {label}
      </Text>
      <Flex gap="xs" align="baseline">
        <Text bold tabular>
          {value}
        </Text>
        {delta !== undefined && Math.abs(delta) >= 0.01 && (
          <Text size="xs" tabular variant={delta < 0 ? 'success' : 'danger'}>
            {`${delta < 0 ? '−' : '+'}${formatPct(Math.abs(delta), 0)}`}
          </Text>
        )}
      </Flex>
    </Container>
  );
}

// Releases

interface ReleaseStats {
  cold: number;
  commit: string;
  deployedAt: number;
  end: number;
  failure: number;
  invocations: number;
  p95: number;
  release: string;
  sampled: Invocation[];
  timeouts: number;
  version: number;
  message?: string;
}

export function ReleasesTab({fn, window}: {fn: LambdaFunction; window: TimeWindow}) {
  const theme = useTheme();
  const statColors = useStatColors();
  const now = Date.now();
  const list = releasesOf(fn);
  const stats: ReleaseStats[] = useMemo(
    () =>
      list.map((release, i) => {
        const end = i === 0 ? now : list[i - 1]!.deployedAt;
        // Compare releases on at most their last 24 hours, so old releases aren't favoured by volume.
        const releaseWindow = makeWindow(Math.max(release.deployedAt, end - DAY), end);
        const t0 = totals([fn], releaseWindow);
        return {
          ...release,
          end,
          invocations: t0.invocations,
          failure: failureRate(t0),
          p95: t0.p95,
          timeouts: t0.timeouts + t0.oom,
          cold: coldStartRate(t0),
          sampled: invocations(fn, releaseWindow).filter(
            inv => inv.status !== 'throttled'
          ),
        };
      }),
    [fn, list, now]
  );
  const [a, setA] = useState(stats[0]?.release);
  const [b, setB] = useState(stats[1]?.release);
  const left = stats.find(s => s.release === a);
  const right = stats.find(s => s.release === b);
  const trendWindow = makeWindow(now - 14 * DAY, now);

  return (
    <Stack gap="xl" paddingTop="lg">
      <Text size="sm" variant="muted">
        {t(
          'Releases come from the installer (git SHA) and each Lambda version is a deploy, so regressions and suspect commits work for Lambda like for any other project. Metrics cover each release’s last 24 hours live.'
        )}
      </Text>
      <ReleaseGrid>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell>{t('Release')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Deployed')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Invocations')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Failures')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('p95')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Timeout / OOM')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Cold')}</SimpleTable.HeaderCell>
        </SimpleTable.Header>
        {stats.map((release, i) => {
          const prev = stats[i + 1];
          const regressed =
            prev &&
            (release.p95 > prev.p95 * 1.2 ||
              release.failure > prev.failure * 1.5 ||
              (release.timeouts > 0 && prev.timeouts === 0));
          return (
            <SimpleTable.Row key={release.release}>
              <SimpleTable.RowCell>
                <Stack gap="xs" minWidth="0">
                  <Flex gap="sm" align="center">
                    <Text monospace bold>
                      {release.release}
                    </Text>
                    <Text size="xs" variant="muted">
                      v{release.version}
                    </Text>
                    {i === 0 && <Tag variant="info">{t('live')}</Tag>}
                    {regressed && <Tag variant="danger">{t('regression')}</Tag>}
                  </Flex>
                  <Text size="xs" variant="muted" monospace ellipsis>
                    {release.commit}
                    {release.message ? ` · ${release.message}` : ''}
                  </Text>
                </Stack>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <Text size="sm">{relative(release.deployedAt)}</Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell justify="end">
                <Text tabular>{formatCount(release.invocations)}</Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell justify="end">
                <Text
                  tabular
                  variant={
                    prev && release.failure > prev.failure * 1.5 ? 'danger' : undefined
                  }
                >
                  {formatPct(release.failure, 2)}
                </Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell justify="end">
                <Text
                  tabular
                  variant={prev && release.p95 > prev.p95 * 1.2 ? 'danger' : undefined}
                >
                  {formatMs(release.p95)}
                </Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell justify="end">
                <Text tabular variant={release.timeouts ? 'danger' : 'muted'}>
                  {formatCount(release.timeouts)}
                </Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell justify="end">
                <Text tabular>{formatPct(release.cold)}</Text>
              </SimpleTable.RowCell>
            </SimpleTable.Row>
          );
        })}
      </ReleaseGrid>

      {stats.length > 1 && left && right && (
        <Container border="primary" radius="md" padding="lg">
          <Stack gap="md">
            <Flex justify="between" align="center" wrap="wrap" gap="sm">
              <Text size="lg" bold>
                {t('Compare releases')}
              </Text>
              <Flex gap="sm" align="center">
                <ReleasePicker value={a} options={stats} onChange={setA} />
                <Text variant="muted">{t('vs')}</Text>
                <ReleasePicker value={b} options={stats} onChange={setB} />
              </Flex>
            </Flex>
            <Grid columns="repeat(4, 1fr)" gap="sm">
              <Fact
                label={t('Failures')}
                value={`${formatPct(left.failure, 2)} vs ${formatPct(right.failure, 2)}`}
                delta={
                  right.failure
                    ? (left.failure - right.failure) / right.failure
                    : undefined
                }
              />
              <Fact
                label={t('p95')}
                value={`${formatMs(left.p95)} vs ${formatMs(right.p95)}`}
                delta={(left.p95 - right.p95) / right.p95}
              />
              <Fact
                label={t('Timeouts / OOM')}
                value={`${formatCount(left.timeouts)} vs ${formatCount(right.timeouts)}`}
              />
              <Fact
                label={t('Cold starts')}
                value={`${formatPct(left.cold)} vs ${formatPct(right.cold)}`}
              />
            </Grid>
            <Stack gap="md">
              {[left, right].map(release => {
                const durations = release.sampled.map(inv => inv.durationMs);
                const share = (sampled: Invocation[]) =>
                  bins(
                    sampled.map(inv => inv.durationMs),
                    18,
                    fn.timeoutS * 1000,
                    0
                  ).map(bin => ({
                    ...bin,
                    count: (bin.count / Math.max(1, sampled.length)) * 100,
                  }));
                const sharedMax = Math.max(
                  ...share(left.sampled).map(bin => bin.count),
                  ...share(right.sampled).map(bin => bin.count)
                );
                return (
                  <Stack key={release.release} gap="xs">
                    <Text size="sm" bold monospace>
                      {tct('[release]: [count] sampled invocations', {
                        release: release.release,
                        count: release.sampled.length,
                      })}
                    </Text>
                    <Histogram
                      bins={share(release.sampled)}
                      maxY={sharedMax}
                      unit="% of invocations"
                      formatX={formatMs}
                      formatY={value => `${Math.round(value)}%`}
                      markers={[
                        {
                          label: `p95 ${formatMs(percentile(durations, 0.95))}`,
                          value: percentile(durations, 0.95),
                          variant: 'warning',
                        },
                      ]}
                      height={130}
                    />
                  </Stack>
                );
              })}
            </Stack>
          </Stack>
        </Container>
      )}

      <Grid columns={{xs: '1fr', lg: '1fr 1fr'}} gap="md">
        <ChartWidget
          title={t('Duration, last 14 days')}
          source="spans"
          window={trendWindow}
          fixedWindow
          releasesFor={[fn]}
          stats={['p95']}
          plottables={(w, picked) =>
            picked.map(
              stat =>
                new Line(metricSeries([fn], stat, w, STAT_LABEL[stat]), {
                  alias: STAT_LABEL[stat],
                  color: statColors[stat],
                })
            )
          }
        />
        <ChartWidget
          title={t('Errors, last 14 days')}
          source="extension"
          window={trendWindow}
          fixedWindow
          releasesFor={[fn]}
          plottables={w => [
            new Bars(metricSeries([fn], 'errors', w), {
              alias: t('errors'),
              color: theme.tokens.graphics.danger.vibrant,
            }),
          ]}
        />
      </Grid>
      {window.end - window.start < 12 * HOUR && (
        <Text size="xs" variant="muted">
          {t(
            'The 14-day chart ignores the page time range so earlier deploys stay visible.'
          )}
        </Text>
      )}
    </Stack>
  );
}

function ReleasePicker({
  value,
  options,
  onChange,
}: {
  onChange: (value: string) => void;
  options: ReleaseStats[];
  value: string | undefined;
}) {
  return (
    <CompactSelect
      value={value}
      options={options.map(o => ({
        value: o.release,
        label: `${o.release} (v${o.version})`,
      }))}
      onChange={option => onChange(option.value)}
      trigger={triggerProps => <OverlayTrigger.Button {...triggerProps} size="xs" />}
    />
  );
}

function relative(timestamp: number) {
  const hours = (Date.now() - timestamp) / HOUR;
  return hours < 48
    ? t('%s hours ago', Math.round(hours))
    : t('%s days ago', Math.round(hours / 24));
}

function ShareBar({ratio}: {ratio: number}) {
  return (
    <Flex gap="sm" align="center" width="100%">
      <ShareTrack>
        <ShareFill style={{width: `${ratio * 100}%`}} />
      </ShareTrack>
      <Text size="sm" tabular>
        {formatPct(ratio, 0)}
      </Text>
    </Flex>
  );
}

const ImportsGrid = styled(SimpleTable)`
  grid-template-columns: minmax(0, 1.4fr) max-content max-content minmax(160px, 1fr);
`;

const SizingGrid = styled(SimpleTable)`
  grid-template-columns: minmax(0, 1.5fr) repeat(4, max-content);
`;

const SizingRow = styled(SimpleTable.Row, {
  shouldForwardProp: prop => !['selected'].includes(prop),
})<{selected: boolean}>`
  cursor: pointer;
  background: ${p => (p.selected ? p.theme.tokens.background.secondary : 'transparent')};
  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

const ReleaseGrid = styled(SimpleTable)`
  grid-template-columns: minmax(0, 2fr) max-content repeat(5, max-content);
`;

const ShareTrack = styled('div')`
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: ${p => p.theme.tokens.background.tertiary};
  overflow: hidden;
`;

const ShareFill = styled('div')`
  height: 100%;
  background: ${p => p.theme.tokens.graphics.accent.vibrant};
`;
