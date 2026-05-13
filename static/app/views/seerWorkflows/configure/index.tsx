import {useEffect, useMemo, useState} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading, Text} from '@sentry/scraps/text';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TimeSince} from 'sentry/components/timeSince';
import {IconClock, IconClose, IconList, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  MOCK_CONFIGURED_WORKFLOWS,
  MOCK_INTERNAL_LAST_RUNS,
} from 'sentry/views/seerWorkflows/mockConfiguredWorkflows';
import {MockToggle} from 'sentry/views/seerWorkflows/mockToggle';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  FREQUENCY_LABELS,
  NOTIFICATION_META,
  requiresNotification,
  STRATEGY_META,
  STRATEGY_OUTPUTS,
} from 'sentry/views/seerWorkflows/strategies';
import type {
  Frequency,
  NotificationChannel,
  StrategyCategory,
  WorkflowKind,
} from 'sentry/views/seerWorkflows/types';

const CONFIGURABLE_KINDS = (Object.keys(STRATEGY_META) as WorkflowKind[]).filter(
  kind => STRATEGY_META[kind].visibility === 'configurable'
);

const INTERNAL_KINDS = (Object.keys(STRATEGY_META) as WorkflowKind[]).filter(
  kind => STRATEGY_META[kind].visibility === 'internal'
);

function groupKindsByCategory(
  kinds: WorkflowKind[]
): Partial<Record<StrategyCategory, WorkflowKind[]>> {
  const out: Partial<Record<StrategyCategory, WorkflowKind[]>> = {};
  for (const kind of kinds) {
    const cat = STRATEGY_META[kind].category;
    const bucket = out[cat] ?? [];
    bucket.push(kind);
    out[cat] = bucket;
  }
  return out;
}

const CONFIGURABLE_BY_CATEGORY = groupKindsByCategory(CONFIGURABLE_KINDS);
const INTERNAL_BY_CATEGORY = groupKindsByCategory(INTERNAL_KINDS);

type CadenceValue = Frequency | 'disabled';

function SeerWorkflowsConfigure() {
  const organization = useOrganization();
  const location = useLocation();
  const isSentryEmployee = useIsSentryEmployee();
  const [overrides, setOverrides] = useState(
    () => new Map<WorkflowKind, Frequency | null>()
  );
  const [notificationOverrides, setNotificationOverrides] = useState(
    () => new Map<WorkflowKind, NotificationChannel>()
  );
  const [viewFilter, setViewFilter] = useState<'all' | 'active'>('all');

  const showMocks = location.query.mock === '1';

  // Snapshot of which kinds are active at mount time (and when the mock toggle
  // flips). Used to pin the active-first ordering inside each category so
  // toggling a card's cadence doesn't reshuffle the list mid-session. The
  // ordering only reflows on page refresh or when mocks are toggled.
  const [initialActiveKinds, setInitialActiveKinds] = useState<Set<WorkflowKind>>(
    () => new Set(showMocks ? MOCK_CONFIGURED_WORKFLOWS.map(w => w.strategy) : [])
  );
  useEffect(() => {
    setInitialActiveKinds(
      new Set(showMocks ? MOCK_CONFIGURED_WORKFLOWS.map(w => w.strategy) : [])
    );
  }, [showMocks]);

  const cadenceByKind = useMemo<Map<WorkflowKind, Frequency>>(() => {
    const base = new Map<WorkflowKind, Frequency>();
    if (showMocks) {
      for (const w of MOCK_CONFIGURED_WORKFLOWS) base.set(w.strategy, w.frequency);
    }
    for (const [kind, value] of overrides) {
      if (value === null) base.delete(kind);
      else base.set(kind, value);
    }
    return base;
  }, [showMocks, overrides]);

  const notificationByKind = useMemo<Map<WorkflowKind, NotificationChannel>>(() => {
    const base = new Map<WorkflowKind, NotificationChannel>();
    if (showMocks) {
      for (const w of MOCK_CONFIGURED_WORKFLOWS) {
        base.set(w.strategy, w.notification);
      }
    }
    for (const [kind, value] of notificationOverrides) {
      base.set(kind, value);
    }
    return base;
  }, [showMocks, notificationOverrides]);

  const lastRunAtByKind = useMemo<Map<WorkflowKind, string>>(() => {
    const map = new Map<WorkflowKind, string>();
    if (!showMocks) return map;
    for (const w of MOCK_CONFIGURED_WORKFLOWS) {
      if (w.lastRunAt) map.set(w.strategy, w.lastRunAt);
    }
    return map;
  }, [showMocks]);

  const handleCadenceChange = (kind: WorkflowKind, next: CadenceValue) => {
    setOverrides(prev => {
      const out = new Map(prev);
      out.set(kind, next === 'disabled' ? null : next);
      return out;
    });
    // Auto-promote 'none' → 'slack' the moment a required-notification kind is
    // enabled. Without this, the dropdown would show 'No notifications' as the
    // current value with that option disabled — a broken state.
    if (next !== 'disabled' && requiresNotification(kind)) {
      setNotificationOverrides(prev => {
        const current = prev.get(kind);
        if (current === undefined || current === 'none') {
          const out = new Map(prev);
          out.set(kind, 'slack');
          return out;
        }
        return prev;
      });
    }
  };

  const handleNotificationChange = (kind: WorkflowKind, next: NotificationChannel) => {
    setNotificationOverrides(prev => {
      const out = new Map(prev);
      out.set(kind, next);
      return out;
    });
  };

  return (
    <SentryDocumentTitle
      title={t('Configure Sentry Workflows')}
      orgSlug={organization.slug}
    >
      <Flex direction="column" gap="2xl" padding={{xs: 'xl', md: '2xl', lg: '3xl'}}>
        <Flex justify="between" align="start" gap="md">
          <Flex direction="column" gap="xs">
            <Heading as="h1">{t('Configure Sentry Workflows')}</Heading>
            <Text as="p" variant="muted">
              {t('Manage the workflows Sentry runs for your organization.')}
            </Text>
          </Flex>
          <Flex gap="sm" align="center">
            <MockToggle />
            <LinkButton
              icon={<IconList />}
              to={`/organizations/${organization.slug}/issues/autofix/`}
            >
              {t('View runs')}
            </LinkButton>
          </Flex>
        </Flex>

        <Container width="100%" maxWidth="1000px">
          <Flex direction="column" gap="lg">
            <Flex justify="between" align="center" gap="md" wrap="wrap">
              <Heading as="h2" size="md">
                {t('Your workflows')}
              </Heading>
              <CompactSelect
                value={viewFilter}
                options={[
                  {value: 'all', label: t('All workflows')},
                  {value: 'active', label: t('Active only')},
                ]}
                onChange={selected => setViewFilter(selected.value)}
                trigger={triggerProps => (
                  <OverlayTrigger.Button {...triggerProps} size="xs" prefix={t('Show')} />
                )}
              />
            </Flex>
            {viewFilter === 'active' ? (
              (() => {
                const activeKinds = CONFIGURABLE_KINDS.filter(k => cadenceByKind.has(k));
                if (activeKinds.length === 0) {
                  return (
                    <Container
                      background="primary"
                      border="primary"
                      radius="md"
                      padding="lg xl"
                    >
                      <Text variant="muted" size="sm">
                        {t(
                          'No active workflows. Pick a cadence on any workflow to enable it.'
                        )}
                      </Text>
                    </Container>
                  );
                }
                return (
                  <Stack gap="md">
                    {activeKinds.map(kind => (
                      <StrategyCard
                        key={kind}
                        kind={kind}
                        frequency={cadenceByKind.get(kind) ?? null}
                        notification={notificationByKind.get(kind) ?? 'none'}
                        lastRunAt={lastRunAtByKind.get(kind)}
                        organizationSlug={organization.slug}
                        onCadenceChange={next => handleCadenceChange(kind, next)}
                        onNotificationChange={next =>
                          handleNotificationChange(kind, next)
                        }
                      />
                    ))}
                  </Stack>
                );
              })()
            ) : (
              <Flex direction="column" gap="lg">
                {CATEGORY_ORDER.filter(cat => CONFIGURABLE_BY_CATEGORY[cat]?.length).map(
                  cat => {
                    const kindsInCat = CONFIGURABLE_BY_CATEGORY[cat]!;
                    const ordered = [
                      ...kindsInCat.filter(k => initialActiveKinds.has(k)),
                      ...kindsInCat.filter(k => !initialActiveKinds.has(k)),
                    ];
                    return (
                      <Flex direction="column" gap="sm" key={cat}>
                        <Text size="xs" variant="muted" uppercase bold>
                          {CATEGORY_LABELS[cat]}
                        </Text>
                        <Stack gap="md">
                          {ordered.map(kind => (
                            <StrategyCard
                              key={kind}
                              kind={kind}
                              frequency={cadenceByKind.get(kind) ?? null}
                              notification={notificationByKind.get(kind) ?? 'none'}
                              lastRunAt={lastRunAtByKind.get(kind)}
                              organizationSlug={organization.slug}
                              onCadenceChange={next => handleCadenceChange(kind, next)}
                              onNotificationChange={next =>
                                handleNotificationChange(kind, next)
                              }
                            />
                          ))}
                        </Stack>
                      </Flex>
                    );
                  }
                )}
              </Flex>
            )}
          </Flex>
        </Container>

        {isSentryEmployee ? (
          <Container width="100%" maxWidth="1000px">
            <Flex direction="column" gap="lg">
              <Flex justify="between" align="center" gap="md" wrap="wrap">
                <Heading as="h2" size="md">
                  {t('System workflows')}
                </Heading>
                <Flex gap="xs" align="center">
                  <Container
                    display="inline-block"
                    border="warning"
                    radius="sm"
                    padding="2xs xs"
                  >
                    <Text size="xs" variant="warning" uppercase bold>
                      {t('Employee only')}
                    </Text>
                  </Container>
                  <Container
                    display="inline-block"
                    border="muted"
                    radius="sm"
                    padding="2xs xs"
                  >
                    <Text size="xs" variant="muted" uppercase>
                      {t('Managed by Sentry')}
                    </Text>
                  </Container>
                </Flex>
              </Flex>
              <Flex direction="column" gap="lg">
                {CATEGORY_ORDER.filter(cat => INTERNAL_BY_CATEGORY[cat]?.length).map(
                  cat => (
                    <Flex direction="column" gap="sm" key={cat}>
                      <Text size="xs" variant="muted" uppercase bold>
                        {CATEGORY_LABELS[cat]}
                      </Text>
                      <Stack gap="md">
                        {INTERNAL_BY_CATEGORY[cat]!.map(kind => (
                          <InternalStrategyCard
                            key={kind}
                            kind={kind}
                            lastRunAt={MOCK_INTERNAL_LAST_RUNS[kind]}
                            organizationSlug={organization.slug}
                          />
                        ))}
                      </Stack>
                    </Flex>
                  )
                )}
              </Flex>
            </Flex>
          </Container>
        ) : null}
      </Flex>
    </SentryDocumentTitle>
  );
}

function StrategyCard({
  kind,
  frequency,
  notification,
  lastRunAt,
  organizationSlug,
  onCadenceChange,
  onNotificationChange,
}: {
  frequency: Frequency | null;
  kind: WorkflowKind;
  notification: NotificationChannel;
  onCadenceChange: (next: CadenceValue) => void;
  onNotificationChange: (next: NotificationChannel) => void;
  organizationSlug: string;
  lastRunAt?: string;
}) {
  const meta = STRATEGY_META[kind];
  const StrategyIcon = meta.Icon;
  const isEnabled = frequency !== null;
  const accentVariant = isEnabled ? 'accent' : 'muted';

  const cadenceOptions = useMemo(
    () => [
      ...meta.frequencies.map(f => ({
        value: f,
        label: FREQUENCY_LABELS[f],
        leadingItems: <IconClock size="xs" />,
      })),
      {
        value: 'disabled' as const,
        label: t('Disabled'),
        leadingItems: <IconSubtract size="xs" />,
      },
    ],
    [meta.frequencies]
  );

  const notificationIsRequired = requiresNotification(kind);

  // When the workflow is disabled, the notification dropdown displays
  // "No notifications" regardless of the stored value — nothing's running so a
  // channel is meaningless. The stored value is preserved so re-enabling
  // restores the prior choice.
  const displayNotification = isEnabled ? notification : 'none';

  const notificationOptions = useMemo(
    () =>
      (Object.keys(NOTIFICATION_META) as NotificationChannel[]).map(channel => {
        const {Icon, label} = NOTIFICATION_META[channel];
        return {
          value: channel,
          label,
          leadingItems: Icon ? <Icon size="xs" /> : <IconClose size="xs" />,
          disabled: channel === 'none' && notificationIsRequired,
        };
      }),
    [notificationIsRequired]
  );

  const displayNotificationMeta = NOTIFICATION_META[displayNotification];
  const NotificationIcon = displayNotificationMeta.Icon;

  return (
    <Container background="primary" border="primary" radius="md" padding="lg xl">
      <Flex direction="column" gap="sm">
        <Flex justify="between" align="center" gap="md" wrap="wrap">
          <Link
            to={{
              pathname: `/organizations/${organizationSlug}/issues/autofix/`,
              query: {strategy: kind},
            }}
          >
            <Flex gap="xs" align="center">
              <StrategyIcon size="sm" variant={accentVariant} />
              <Heading as="h4" size="md" variant={accentVariant}>
                {meta.label}
              </Heading>
            </Flex>
          </Link>
          <Flex gap="xs" align="center" wrap="wrap">
            <CompactSelect
              value={frequency ?? 'disabled'}
              options={cadenceOptions}
              onChange={selected => onCadenceChange(selected.value)}
              trigger={triggerProps => (
                <OverlayTrigger.Button
                  {...triggerProps}
                  size="xs"
                  icon={isEnabled ? <IconClock /> : <IconSubtract />}
                >
                  {frequency ? FREQUENCY_LABELS[frequency] : t('Disabled')}
                </OverlayTrigger.Button>
              )}
            />
            <CompactSelect
              value={displayNotification}
              options={notificationOptions}
              disabled={!isEnabled}
              onChange={selected => onNotificationChange(selected.value)}
              trigger={triggerProps => (
                <OverlayTrigger.Button
                  {...triggerProps}
                  size="xs"
                  icon={NotificationIcon ? <NotificationIcon /> : <IconClose />}
                >
                  {displayNotificationMeta.label}
                </OverlayTrigger.Button>
              )}
            />
          </Flex>
        </Flex>
        <Text variant="muted" size="sm">
          {meta.summary}
        </Text>
        {meta.outputs.length > 0 ? (
          <Flex gap="xs" align="center" wrap="wrap">
            <Text size="xs" variant="muted" uppercase bold>
              {t('Outputs')}
            </Text>
            {meta.outputs.map(outputId => {
              const {Icon: OutputIcon, label} = STRATEGY_OUTPUTS[outputId];
              const chipLabel =
                outputId === 'notification' && isEnabled
                  ? `${label}: ${NOTIFICATION_META[displayNotification].label}`
                  : label;
              return (
                <Container
                  key={outputId}
                  display="inline-block"
                  border="muted"
                  radius="sm"
                  padding="2xs xs"
                >
                  <Flex gap="xs" align="center">
                    <Text variant="muted">
                      <OutputIcon size="xs" />
                    </Text>
                    <Text size="xs">{chipLabel}</Text>
                  </Flex>
                </Container>
              );
            })}
          </Flex>
        ) : null}
        {isEnabled ? (
          <Flex justify="end">
            {lastRunAt ? (
              <Link
                to={{
                  pathname: `/organizations/${organizationSlug}/issues/autofix/`,
                  query: {strategy: kind, expandLatest: kind},
                }}
              >
                <Text size="xs" variant="accent" underline="dotted">
                  {t('Last run ')}
                  <TimeSince date={lastRunAt} />
                </Text>
              </Link>
            ) : (
              <Text size="xs" variant="muted">
                {t('Not yet run')}
              </Text>
            )}
          </Flex>
        ) : null}
      </Flex>
    </Container>
  );
}

function InternalStrategyCard({
  kind,
  lastRunAt,
  organizationSlug,
}: {
  kind: WorkflowKind;
  organizationSlug: string;
  lastRunAt?: string;
}) {
  const meta = STRATEGY_META[kind];
  const StrategyIcon = meta.Icon;
  const cadence = meta.frequencies[0];

  return (
    <Container background="primary" border="primary" radius="md" padding="lg xl">
      <Flex direction="column" gap="sm">
        <Flex justify="between" align="center" gap="md" wrap="wrap">
          <Flex gap="xs" align="center">
            <StrategyIcon size="sm" variant="muted" />
            <Heading as="h4" size="md">
              {meta.label}
            </Heading>
          </Flex>
          {cadence ? (
            <Container display="inline-block" border="muted" radius="sm" padding="2xs xs">
              <Flex gap="xs" align="center">
                <Text variant="muted">
                  <IconClock size="xs" />
                </Text>
                <Text size="xs">{FREQUENCY_LABELS[cadence]}</Text>
              </Flex>
            </Container>
          ) : null}
        </Flex>
        <Text variant="muted" size="sm">
          {meta.summary}
        </Text>
        {meta.outputs.length > 0 ? (
          <Flex gap="xs" align="center" wrap="wrap">
            <Text size="xs" variant="muted" uppercase bold>
              {t('Outputs')}
            </Text>
            {meta.outputs.map(outputId => {
              const {Icon: OutputIcon, label} = STRATEGY_OUTPUTS[outputId];
              return (
                <Container
                  key={outputId}
                  display="inline-block"
                  border="muted"
                  radius="sm"
                  padding="2xs xs"
                >
                  <Flex gap="xs" align="center">
                    <Text variant="muted">
                      <OutputIcon size="xs" />
                    </Text>
                    <Text size="xs">{label}</Text>
                  </Flex>
                </Container>
              );
            })}
          </Flex>
        ) : null}
        <Flex justify="end">
          {lastRunAt ? (
            <Link
              to={{
                pathname: `/organizations/${organizationSlug}/issues/autofix/`,
                query: {strategy: kind, expandLatest: kind},
              }}
            >
              <Text size="xs" variant="accent" underline="dotted">
                {t('Last run ')}
                <TimeSince date={lastRunAt} />
              </Text>
            </Link>
          ) : (
            <Text size="xs" variant="muted">
              {t('Not yet run')}
            </Text>
          )}
        </Flex>
      </Flex>
    </Container>
  );
}

export default SeerWorkflowsConfigure;
