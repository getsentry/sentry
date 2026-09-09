import {z} from 'zod';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Table} from '@sentry/scraps/table';
import {Heading, Text} from '@sentry/scraps/text';

import {IconGraph, IconProject} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import type {
  SeerNightShiftRunExtras,
  SeerWorkflowResult,
} from 'sentry/views/seerWorkflows/types';

const monitor = z.object({
  id: z.string().regex(/^\d+$/),
  name: z.string(),
  enabled: z.boolean().optional(),
});
const evidence = z.object({
  reason: z.string(),
  differences: z.array(z.string()),
  matchingSettings: z.array(z.object({label: z.string(), value: z.string()})).default([]),
});
const comparison = z.array(
  z.object({
    property: z.string(),
    values: z.array(z.object({monitorId: z.string(), value: z.string()})),
  })
);
const finding = evidence.extend({
  comparison: comparison.default([]),
  kind: z.enum(['exact_duplicate', 'overlapping_coverage', 'duplicate_notifications']),
  monitors: z.array(monitor).min(2),
  suggestedKeepId: z.string().nullable(),
  alerts: z.array(monitor),
  example: z.string(),
  nextStep: z.string(),
});
const baseOutput = z.object({
  outputKind: z.literal('monitor_cleanup'),
  projectId: z.string(),
  projectSlug: z.string(),
  scan: z.object({
    status: z.enum(['complete', 'partial']),
    monitorsScanned: z.number().int().nonnegative(),
  }),
  summary: z.string(),
});
const outputSchema = z.union([
  baseOutput.extend({
    schemaVersion: z.literal(2),
    findings: z.array(finding),
  }),
  baseOutput
    .extend({
      schemaVersion: z.literal(1),
      groups: z.array(evidence.extend({keep: monitor, duplicates: z.array(monitor)})),
    })
    .transform(output => ({
      ...output,
      findings: output.groups.map(group => ({
        ...group,
        kind: 'legacy_duplicate' as const,
        comparison: [],
        monitors: [group.keep, ...group.duplicates],
        suggestedKeepId: group.keep.id,
        alerts: [],
        example: '',
        nextStep: '',
      })),
    })),
]);
type Finding = z.infer<typeof outputSchema>['findings'][number];

export function getMonitorFindingSummary(results: SeerWorkflowResult[]) {
  const counts = {
    exact_duplicate: 0,
    overlapping_coverage: 0,
    duplicate_notifications: 0,
    legacy_duplicate: 0,
  };
  let supported = 0;
  for (const result of results) {
    const parsed = outputSchema.safeParse(result.extras);
    if (parsed.success) {
      supported++;
      for (const item of parsed.data.findings) {
        counts[item.kind]++;
      }
    }
  }
  if (!supported) {
    return t('Findings unavailable');
  }
  const labels = [
    counts.exact_duplicate
      ? tn(
          '%s exact duplicate group',
          '%s exact duplicate groups',
          counts.exact_duplicate
        )
      : null,
    counts.overlapping_coverage
      ? tn('%s overlap', '%s overlaps', counts.overlapping_coverage)
      : null,
    counts.duplicate_notifications
      ? tn(
          '%s notification risk',
          '%s notification risks',
          counts.duplicate_notifications
        )
      : null,
    counts.legacy_duplicate
      ? tn(
          '%s possible duplicate group',
          '%s possible duplicate groups',
          counts.legacy_duplicate
        )
      : null,
  ].filter(Boolean);
  return labels.length ? labels.join(' · ') : t('No findings');
}

function findingLabel(kind: Finding['kind']) {
  switch (kind) {
    case 'exact_duplicate':
      return t('Exact duplicates');
    case 'overlapping_coverage':
      return t('Overlapping coverage');
    case 'duplicate_notifications':
      return t('Potential duplicate notifications');
    case 'legacy_duplicate':
      return t('Possible duplicates');
    default:
      return kind satisfies never;
  }
}

function PropertyComparison({item}: {item: Finding}) {
  const rows =
    item.comparison.length > 0
      ? item.comparison
      : item.matchingSettings.map(setting => ({
          property: setting.label,
          values: item.monitors.map(member => ({
            monitorId: member.id,
            value: setting.value,
          })),
        }));
  if (rows.length === 0) {
    return (
      <Text size="sm" variant="muted">
        {t('Run a new scan to compare monitor properties.')}
      </Text>
    );
  }
  return (
    <Container overflowX="auto">
      <Table
        columns={[
          {key: 'property', width: 'minmax(100px, 1fr)', resizable: false},
          ...item.monitors.map(member => ({
            key: member.id,
            width: 'minmax(140px, 2fr)',
            resizable: false,
          })),
        ]}
      >
        <Table.Head>
          <Table.Row>
            <Table.HeadCell column="property">{t('Property')}</Table.HeadCell>
            {item.monitors.map(member => (
              <Table.HeadCell key={member.id} column={member.id}>
                <Text size="sm" bold wrap="normal" wordBreak="break-word">
                  {member.name}
                </Text>
              </Table.HeadCell>
            ))}
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {rows.map((row, index) => {
            const differs = new Set(row.values.map(value => value.value)).size > 1;
            return (
              <Table.Row key={index} divider>
                <Table.Cell>
                  <Text size="sm">{row.property}</Text>
                </Table.Cell>
                {item.monitors.map(member => (
                  <Table.Cell key={member.id}>
                    <Text
                      size="sm"
                      wrap="normal"
                      wordBreak="break-word"
                      variant={differs ? 'warning' : 'primary'}
                    >
                      {row.values.find(value => value.monitorId === member.id)?.value ??
                        t('Not inspected')}
                    </Text>
                  </Table.Cell>
                ))}
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
      {item.comparison.length === 0 && item.differences.length > 0 && (
        <Text size="xs" variant="muted">
          {t(
            'Only matching properties were saved in this older scan. Run a new scan for a full comparison.'
          )}
        </Text>
      )}
    </Container>
  );
}

function FindingCard({
  item,
  organizationSlug,
}: {
  item: Finding;
  organizationSlug: string;
}) {
  const canSuggestKeep =
    item.kind === 'exact_duplicate' || item.kind === 'legacy_duplicate';
  return (
    <Stack
      border="primary"
      radius="md"
      background="primary"
      padding="lg"
      gap="md"
      minWidth="0"
    >
      <Heading as="h4" size="sm">
        {findingLabel(item.kind)}
      </Heading>
      <Stack gap="sm">
        {item.monitors.map(member => (
          <Flex key={member.id} gap="sm" align="center" wrap="wrap">
            <IconGraph type="area" size="xs" />
            <Link to={makeMonitorDetailsPathname(organizationSlug, member.id)}>
              <Text size="sm" variant="accent">
                {member.name}
              </Text>
            </Link>
            {canSuggestKeep && member.id === item.suggestedKeepId && (
              <Tag variant="success">{t('Suggested keep')}</Tag>
            )}
            {member.enabled === false && (
              <Text size="xs" variant="muted">
                {t('Disabled')}
              </Text>
            )}
          </Flex>
        ))}
      </Stack>
      <Text size="sm" wrap="normal" wordBreak="break-word">
        {item.reason}
      </Text>
      {item.alerts.map(alert => (
        <Flex key={alert.id} gap="sm" align="center" wrap="wrap">
          <Text size="xs" variant="muted">
            {t('Alert')}
          </Text>
          <Link to={makeAutomationDetailsPathname(organizationSlug, alert.id)}>
            <Text size="sm" variant="accent">
              {alert.name}
            </Text>
          </Link>
          {alert.enabled === false && (
            <Text size="xs" variant="muted">
              {t('Disabled')}
            </Text>
          )}
        </Flex>
      ))}
      <Disclosure size="sm">
        <Disclosure.Title>{t('View comparison')}</Disclosure.Title>
        <Disclosure.Content>
          <Stack gap="lg" paddingTop="md">
            <PropertyComparison item={item} />
            {canSuggestKeep && (
              <Flex>
                <Button variant="danger" disabled size="sm">
                  {t('Delete duplicates')}
                </Button>
              </Flex>
            )}
          </Stack>
        </Disclosure.Content>
      </Disclosure>
    </Stack>
  );
}

export function MonitorCleanupResults({
  results,
  organizationSlug,
  coverage,
}: {
  organizationSlug: string;
  results: SeerWorkflowResult[];
  coverage?: SeerNightShiftRunExtras['coverage'];
}) {
  const parsed = results.map(result => ({
    id: result.id,
    output: outputSchema.safeParse(result.extras),
  }));
  const projects = new Map(
    parsed.flatMap(({output}) =>
      output.success ? [[output.data.projectId, output.data] as const] : []
    )
  );
  const inspected = [...projects.values()].reduce(
    (total, output) => total + output.scan.monitorsScanned,
    0
  );
  const incomplete =
    parsed.some(({output}) => !output.success || output.data.scan.status === 'partial') ||
    (coverage && coverage.complete < coverage.total);
  return (
    <Stack gap="xl" containerType="inline-size">
      {projects.size > 0 && (
        <Stack gap="sm" padding="lg" background="secondary" radius="md">
          <Text size="sm">
            {t(
              '%s across %s',
              tn('%s monitor inspected', '%s monitors inspected', inspected),
              tn('%s project', '%s projects', projects.size)
            )}
          </Text>
          {incomplete && (
            <Text size="sm" variant="warning">
              {t(
                'These counts cover the results received so far. Some inspection is incomplete.'
              )}
            </Text>
          )}
        </Stack>
      )}
      {parsed.some(({output}) => !output.success) && (
        <Text variant="warning">{t('This monitor scan output is not supported.')}</Text>
      )}
      {Array.from(projects.values(), output => (
        <Stack key={output.projectId} gap="lg">
          <Flex align="center" gap="sm">
            <IconProject size="xs" />
            <Heading as="h3" size="sm">
              {output.projectSlug}
            </Heading>
          </Flex>
          {output.scan.status === 'partial' && (
            <Container padding="md" border="warning" radius="md">
              <Text variant="warning">
                {t('This scan is incomplete. Some monitors may not have been inspected.')}
              </Text>
            </Container>
          )}
          {output.findings.length === 0 && (
            <Text variant="muted">
              {output.scan.status === 'complete'
                ? t('No findings to review.')
                : t('No candidates returned from the inspected monitors.')}
            </Text>
          )}
          {output.findings.map((item, index) => (
            <FindingCard key={index} item={item} organizationSlug={organizationSlug} />
          ))}
        </Stack>
      ))}
    </Stack>
  );
}
