import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {MiniBarChart} from 'sentry/components/charts/miniBarChart';
import {NotFound} from 'sentry/components/errors/notFound';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import {useAutomationsEnabled} from 'sentry/views/seerWorkflows/utils';

type SpendPeriod = '7d' | '30d' | '90d' | '6m';

// TODO: Replace mock values with automation data from the API / props
const MOCK_INSTRUCTIONS =
  'Review unresolved issues by user impact and recency, judge which are fixable from the available evidence, group issues that share a cause, and start Autofix for the most fixable groups.';
const MOCK_SCHEDULE = 'twice-daily';
const MOCK_PROJECTS: string[] = [];
const MOCK_ENVIRONMENT = 'production';
const MOCK_ACTIONS = {
  sendNotifications: true,
  startInvestigations: true,
  openPullRequests: true,
};
const MOCK_SPEND_PERIOD: SpendPeriod = '30d';
const MOCK_ESTIMATED_SPEND_TODAY = '$2.50';
const MOCK_ESTIMATED_SPEND_PER_RUN = '$2.50';

const DAY_MS = 24 * 60 * 60 * 1000;
const MOCK_START = new Date('2026-09-23T00:00:00Z').getTime();

function mockSeriesData(days: number, seed: number, max: number) {
  return Array.from({length: days}, (_, i) => ({
    name: MOCK_START + i * DAY_MS,
    value: Math.round(((Math.sin(i * seed) + 1) / 2) * max * 0.7 + max * 0.2),
  }));
}

function ConfigSection({title, children}: {children: React.ReactNode; title: string}) {
  return (
    <Stack gap="md">
      <Container paddingLeft="md">
        <Text bold size="lg">
          {title}
        </Text>
      </Container>
      <Container border="primary" radius="md">
        {children}
      </Container>
    </Stack>
  );
}

function ConfigRow({
  label,
  description,
  control,
  hasBorder,
}: {
  control: React.ReactNode;
  label: React.ReactNode;
  description?: React.ReactNode;
  hasBorder?: boolean;
}) {
  return (
    <Grid
      columns="1fr 1fr"
      gap="lg"
      align="center"
      padding="lg"
      borderTop={hasBorder ? 'primary' : undefined}
    >
      <Stack gap="xs">
        <Text bold>{label}</Text>
        {description && <Text variant="muted">{description}</Text>}
      </Stack>
      <Flex>{control}</Flex>
    </Grid>
  );
}

export default function AutomationConfiguration() {
  const automationsEnabled = useAutomationsEnabled();
  const theme = useTheme();
  const colors = theme.chart.getColorPalette(3);

  const activitySeries: Series[] = useMemo(
    () => [
      {seriesName: t('Issues'), data: mockSeriesData(30, 0.9, 40)},
      {seriesName: t('Investigations'), data: mockSeriesData(30, 1.7, 15)},
      {seriesName: t('PRs'), data: mockSeriesData(30, 2.3, 2)},
    ],
    []
  );
  const spendSeries: Series[] = useMemo(
    () => [{seriesName: t('Spend'), data: mockSeriesData(30, 1.3, 7)}],
    []
  );
  const totalSpend = spendSeries[0]!.data.reduce((sum, d) => sum + d.value, 0);

  const actions = [
    {
      key: 'sendNotifications' as const,
      label: t('Send notifications'),
      description: t('Post findings to Slack, the inbox, and the daily email digest.'),
    },
    {
      key: 'startInvestigations' as const,
      label: t('Start investigations'),
      description: t('Open an investigation when a finding needs a closer look.'),
    },
    {
      key: 'openPullRequests' as const,
      label: t('Open pull requests'),
      description: t('Propose a fix as a pull request for someone to review and merge.'),
    },
  ];

  if (!automationsEnabled) {
    return <NotFound />;
  }

  return (
    <Stack gap="xl" maxWidth="960px">
      <ConfigSection title={t('Description')}>
        <Container padding="md">
          <TextArea value={MOCK_INSTRUCTIONS} autosize disabled readOnly />
        </Container>
      </ConfigSection>

      <ConfigSection title={t('Trigger')}>
        <ConfigRow
          label={t('Schedule')}
          description={t('Runs on a schedule.')}
          control={
            <CompactSelect
              disabled
              value={MOCK_SCHEDULE}
              onChange={() => {}}
              options={[
                {value: 'daily', label: t('Every day at 8 AM')},
                {value: 'twice-daily', label: t('Every day at 8 AM and 8 PM')},
              ]}
            />
          }
        />
      </ConfigSection>

      <ConfigSection title={t('Scope')}>
        <ConfigRow
          label={t('Projects')}
          description={t('Leave empty for all projects.')}
          control={
            <Input
              disabled
              placeholder={t('All projects')}
              value={MOCK_PROJECTS.join(', ')}
              readOnly
            />
          }
        />
        <ConfigRow
          hasBorder
          label={t('Environments')}
          control={
            <CompactSelect
              disabled
              value={MOCK_ENVIRONMENT}
              onChange={() => {}}
              options={[{value: MOCK_ENVIRONMENT, label: MOCK_ENVIRONMENT}]}
            />
          }
        />
      </ConfigSection>

      <ConfigSection title={t('Actions')}>
        {actions.map((action, i) => (
          <ConfigRow
            key={action.key}
            hasBorder={i > 0}
            label={action.label}
            description={action.description}
            control={<Switch size="lg" checked={MOCK_ACTIONS[action.key]} disabled />}
          />
        ))}
      </ConfigSection>

      <ConfigSection title={t('Spend')}>
        <Stack gap="lg" padding="lg">
          <Flex justify="end">
            <SegmentedControl<SpendPeriod>
              aria-label={t('Spend period')}
              size="xs"
              value={MOCK_SPEND_PERIOD}
              onChange={() => {}}
            >
              <SegmentedControl.Item key="7d" disabled>
                {t('7D')}
              </SegmentedControl.Item>
              <SegmentedControl.Item key="30d" disabled>
                {t('30D')}
              </SegmentedControl.Item>
              <SegmentedControl.Item key="90d" disabled>
                {t('90D')}
              </SegmentedControl.Item>
              <SegmentedControl.Item key="6m" disabled>
                {t('6M')}
              </SegmentedControl.Item>
            </SegmentedControl>
          </Flex>
          <Grid columns="1fr 1fr" gap="xl">
            <Stack gap="sm">
              <Text bold size="sm">
                {t('Activity')}
              </Text>
              <MiniBarChart
                isGroupedByDate
                stacked
                labelYAxisExtents
                height={150}
                colors={colors}
                series={activitySeries}
              />
            </Stack>
            <Stack gap="sm">
              <Flex justify="between">
                <Text bold size="sm">
                  {t('Spend')}
                </Text>
                <Text variant="muted" size="sm">
                  {t('$%s total', totalSpend.toFixed(2))}
                </Text>
              </Flex>
              <MiniBarChart
                isGroupedByDate
                labelYAxisExtents
                height={150}
                colors={colors}
                series={spendSeries}
              />
            </Stack>
          </Grid>
        </Stack>
      </ConfigSection>

      <Container border="primary" radius="md">
        <ConfigRow
          label={t('Estimated spend today')}
          description={t('Resets each day at 00:00 UTC.')}
          control={
            <Stack gap="xs">
              <Text bold>{MOCK_ESTIMATED_SPEND_TODAY}</Text>
              <Text variant="muted" size="sm">
                {t(
                  'Estimated %s per run. Investigation costs may vary.',
                  MOCK_ESTIMATED_SPEND_PER_RUN
                )}
              </Text>
            </Stack>
          }
        />
      </Container>
    </Stack>
  );
}
