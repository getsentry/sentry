import {Fragment, type ReactNode} from 'react';
import {IconChevron} from '@sentry/icons/chevron';
import {IconClock} from '@sentry/icons/clock';
import {IconFire} from '@sentry/icons/fire';
import {IconRefresh} from '@sentry/icons/refresh';
import {IconWarning} from '@sentry/icons/warning';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {InfoTip} from '@sentry/scraps/info';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  KeyValueTableCard,
  KeyValueTableCardGrid,
  type KeyValueTableDataRowProps,
} from 'sentry/components/tables/keyValueTable';
import {t, tn} from 'sentry/locale';
import type {RawCrumb} from 'sentry/types/breadcrumbs';
import {EntryType, type Event, type ExceptionValue} from 'sentry/types/event';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {defined} from 'sentry/utils/defined';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import type {
  FaultCategory,
  FaultedWarp,
  GPUCrashContext,
} from './contexts/knownContext/gpuCrash';

type ShaderType =
  | 'Vertex'
  | 'Hull'
  | 'Domain'
  | 'Geometry'
  | 'Pixel'
  | 'Compute'
  | 'Task'
  | 'Mesh'
  | 'RayGeneration'
  | 'RayIntersection'
  | 'RayAnyHit'
  | 'RayClosestHit'
  | 'RayMiss'
  | 'RayCallable';

type Stage = {code: string; name: string; role: string; shaderType?: ShaderType};

type Lane = {label: string; stages: Stage[]};

type MarkerData = {Pipe?: string; Status?: string; Type?: string; frames?: string[]};

type FlowStep = {
  detail: ReactNode;
  icon: ReactNode;
  label: string;
  variant: 'danger' | 'warning' | 'success';
};

const HANGS: ReadonlySet<FaultCategory | undefined> = new Set([
  'shader_hang',
  'gpu_hang',
]);
const MEMORY_FAULTS: ReadonlySet<FaultCategory | undefined> = new Set([
  'page_fault',
  'dma_fault',
]);

function node(code: string, name: string, role: string, shaderType?: ShaderType): Stage {
  return {code, name, role, shaderType};
}

function getLanes(): Lane[] {
  const pixel = node('PS', t('Pixel'), t('Shades each pixel.'));
  return [
    {
      label: t('Graphics'),
      stages: [
        node('IA', t('Input Assembler'), t('Assembles vertices into primitives.')),
        node('VS', t('Vertex'), t('Transforms each vertex.'), 'Vertex'),
        node('HS', t('Hull'), t('Computes tessellation patch constants.'), 'Hull'),
        node('DS', t('Domain'), t('Evaluates tessellated vertices.'), 'Domain'),
        node('GS', t('Geometry'), t('Emits or derives primitives.'), 'Geometry'),
        node('RS', t('Rasterizer'), t('Turns primitives into pixels.')),
        {...pixel, shaderType: 'Pixel'},
        node('OM', t('Output Merger'), t('Blends and writes render targets.')),
      ],
    },
    {
      label: t('Compute'),
      stages: [node('CS', t('Compute'), t('General-purpose GPU dispatch.'), 'Compute')],
    },
    {
      label: t('Mesh'),
      stages: [
        node('AS', t('Amplification'), t('Launches mesh shader groups.'), 'Task'),
        node('MS', t('Mesh'), t('Produces meshlets.'), 'Mesh'),
        pixel,
      ],
    },
    {
      label: t('Ray tracing'),
      stages: [
        node('RG', t('Ray Generation'), t('Launches rays.'), 'RayGeneration'),
        node('IS', t('Intersection'), t('Tests custom geometry.'), 'RayIntersection'),
        node('AH', t('Any Hit'), t('Runs for every candidate hit.'), 'RayAnyHit'),
        node('CH', t('Closest Hit'), t('Shades the nearest hit.'), 'RayClosestHit'),
        node('MI', t('Miss'), t('Runs when a ray hits nothing.'), 'RayMiss'),
        node('CL', t('Callable'), t('Called from other ray shaders.'), 'RayCallable'),
      ],
    },
  ];
}

function getCategoryLabel(category: FaultCategory | undefined): string {
  switch (category) {
    case 'shader_hang':
      return t('Shader hang');
    case 'gpu_hang':
      return t('GPU hang');
    case 'page_fault':
      return t('Page fault');
    case 'dma_fault':
      return t('DMA fault');
    case 'out_of_memory':
      return t('Out of memory');
    case 'device_reset':
      return t('Device reset');
    case 'device_stopped':
      return t('Device stopped');
    case 'device_removed':
      return t('Device removed');
    default:
      return t('Unknown GPU fault');
  }
}

function getSummary(crash: GPUCrashContext, shader: string | null | undefined): string {
  const kind = crash.shader_type
    ? t('%s shader', String(crash.shader_type).toLowerCase())
    : t('shader');
  const subject = shader ? t('the %s %s', kind, shader) : t('a %s', kind);
  const parts: string[] = [];

  if (HANGS.has(crash.fault_category)) {
    parts.push(
      t(
        'The GPU stopped responding while running %s, so the operating system reset it.',
        subject
      )
    );
  } else if (MEMORY_FAULTS.has(crash.fault_category)) {
    const access = crash.access_type ?? t('memory access');
    const target = crash.resource
      ? t("resource '%s'", crash.resource)
      : (crash.virtual_address ?? t('an invalid address'));
    parts.push(
      crash.shader_type || shader
        ? t('The GPU faulted on a %s of %s while running %s.', access, target, subject)
        : t('The GPU faulted on a %s of %s.', access, target)
    );
  } else if (crash.fault_category === 'out_of_memory') {
    parts.push(t('The GPU ran out of memory.'));
  } else {
    parts.push(
      crash.fault_description ??
        t('The GPU crashed (%s).', getCategoryLabel(crash.fault_category))
    );
  }

  if (crash.resource_destroyed) {
    parts.push(
      t('The resource had already been destroyed, so this is a use-after-free.')
    );
  }
  return parts.join(' ');
}

function getFlow(crash: GPUCrashContext): FlowStep[] {
  const steps: FlowStep[] = [];
  if (crash.device_status) {
    steps.push({
      label: t('Device %s', crash.device_status),
      variant: 'danger',
      icon: <IconFire size="xs" />,
      detail:
        crash.device_state && crash.device_state !== crash.device_status
          ? t('The driver reported device state %s.', crash.device_state)
          : t('The GPU stopped processing work.'),
    });
  }
  if (HANGS.has(crash.fault_category) || crash.fault_type === 'Timeout') {
    steps.push({
      label: t('Timeout / TDR'),
      variant: 'warning',
      icon: <IconClock size="xs" />,
      detail: t(
        'The GPU did not finish within the operating system watchdog window, so the OS reset it (Timeout Detection and Recovery).'
      ),
    });
  } else if (MEMORY_FAULTS.has(crash.fault_category)) {
    steps.push({
      label: getCategoryLabel(crash.fault_category),
      variant: 'warning',
      icon: <IconWarning size="xs" />,
      detail:
        crash.fault_description ??
        t('The GPU accessed an unmapped or invalid memory address.'),
    });
  } else if (crash.fault_category === 'out_of_memory') {
    steps.push({
      label: t('Out of memory'),
      variant: 'warning',
      icon: <IconWarning size="xs" />,
      detail: t('The GPU could not allocate the memory it needed.'),
    });
  }
  if (crash.resource_destroyed) {
    steps.push({
      label: t('Use-after-free'),
      variant: 'danger',
      icon: <IconWarning size="xs" />,
      detail: t('The faulting resource had already been destroyed when the GPU used it.'),
    });
  }
  if (crash.engine_reset) {
    steps.push({
      label: t('Engine reset'),
      variant: 'success',
      icon: <IconRefresh size="xs" />,
      detail: t('The affected GPU engine was reset to recover the device.'),
    });
  }
  if (crash.adapter_reset) {
    steps.push({
      label: t('Adapter reset'),
      variant: 'danger',
      icon: <IconRefresh size="xs" />,
      detail: t('The whole adapter was reset, which is heavier than an engine reset.'),
    });
  }
  return steps;
}

function rows(entries: Array<[string, string, ReactNode]>): KeyValueTableDataRowProps[] {
  return entries
    .filter(([, , value]) => defined(value) && value !== '')
    .map(([key, subject, value]) => ({item: {key, subject, value}}));
}

function getMarkerData(crumb: RawCrumb | undefined): MarkerData {
  return (crumb?.data ?? {}) as MarkerData;
}

function yesNo(value: unknown): string | undefined {
  return typeof value === 'boolean' ? (value ? t('Yes') : t('No')) : undefined;
}

function markerVariant(status: string | undefined): 'warning' | 'success' | 'muted' {
  if (status === 'Executing') {
    return 'warning';
  }
  return status === 'Finished' || status === 'Completed' ? 'success' : 'muted';
}

function frameVariant(frame: string): 'accent' | 'success' | 'muted' {
  const lower = frame.toLowerCase();
  if (/nvwgf2|nvd3d|nvoglv|nvlddmkm/.test(lower)) {
    return 'accent';
  }
  return lower.includes('.exe') ? 'success' : 'muted';
}

function StageTag({crash, stage}: {crash: GPUCrashContext; stage: Stage}) {
  const faulting = defined(stage.shaderType) && stage.shaderType === crash.shader_type;
  const detail = [
    crash.shader_hash && t('shader %s', crash.shader_hash),
    crash.faulting_pc && t('PC %s', crash.faulting_pc),
    defined(crash.active_warps) && t('%s warps', crash.active_warps),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Tooltip
      title={
        <Stack gap="xs">
          <Text bold>{t('%s (%s)', stage.name, stage.code)}</Text>
          <Text size="sm" variant="muted">
            {stage.role}
          </Text>
          {faulting ? (
            <Fragment>
              <Text size="sm" bold variant="danger">
                {t('Faulted in this stage')}
              </Text>
              {detail ? (
                <Text size="xs" monospace variant="muted">
                  {detail}
                </Text>
              ) : null}
            </Fragment>
          ) : null}
        </Stack>
      }
    >
      <Tag
        variant={faulting ? 'danger' : 'muted'}
        icon={faulting ? <IconFire size="xs" /> : undefined}
      >
        {stage.code}
      </Tag>
    </Tooltip>
  );
}

function Pipeline({crash}: {crash: GPUCrashContext}) {
  const lanes = getLanes();
  const graphics = lanes[0]!;
  const lane = lanes.find(l => l.stages.some(s => s.shaderType === crash.shader_type));
  const faulting = lane?.stages.find(s => s.shaderType === crash.shader_type);
  const shown = lane && lane !== graphics ? [graphics, lane] : [graphics];
  const locus = [crash.engine, crash.client].filter(Boolean).join(' / ');

  return (
    <Stack gap="sm">
      <Text size="xs" bold uppercase variant={faulting ? 'danger' : 'muted'}>
        {faulting ? t('GPU pipeline · faulted in %s', faulting.name) : t('GPU pipeline')}
      </Text>
      <Grid columns="max-content 1fr" gap="sm lg" align="center">
        {shown.map(l => (
          <Fragment key={l.label}>
            <Text size="xs" variant="muted">
              {l.label}
            </Text>
            <Flex gap="xs" align="center" wrap="wrap">
              {l.stages.map((stage, i) => (
                <Fragment key={stage.code}>
                  {i > 0 ? <IconChevron direction="right" size="xs" /> : null}
                  <StageTag crash={crash} stage={stage} />
                </Fragment>
              ))}
            </Flex>
          </Fragment>
        ))}
      </Grid>
      {faulting ? null : (
        <Text size="sm" variant="muted">
          {locus
            ? t(
                'No shader stage is attributed to this fault. It originated in %s.',
                locus
              )
            : t('No shader stage is attributed to this fault.')}
        </Text>
      )}
    </Stack>
  );
}

function Flow({steps}: {steps: FlowStep[]}) {
  if (!steps.length) {
    return null;
  }
  return (
    <Stack gap="sm">
      <Text size="xs" bold uppercase variant="muted">
        {t('What happened')}
      </Text>
      <Flex gap="xs" align="center" wrap="wrap">
        {steps.map((step, i) => (
          <Fragment key={step.label}>
            {i > 0 ? <IconChevron direction="right" size="xs" /> : null}
            <Tooltip title={step.detail}>
              <Tag variant={step.variant} icon={step.icon}>
                {step.label}
              </Tag>
            </Tooltip>
          </Fragment>
        ))}
      </Flex>
    </Stack>
  );
}

function FaultPanel({crash}: {crash: GPUCrashContext}) {
  const warps: FaultedWarp[] =
    crash.faulted_warps ??
    (crash.fault_name
      ? [{fault_name: crash.fault_name, fault_detail: crash.fault_detail}]
      : []);
  const isMemoryFault = MEMORY_FAULTS.has(crash.fault_category);
  if (!isMemoryFault && !warps.length) {
    return null;
  }
  const fields = [
    [t('Faulting address'), crash.virtual_address],
    [t('Access'), crash.access_type],
    [t('Fault code'), crash.fault_code],
    [t('Engine'), crash.engine],
    [t('Client'), crash.client],
    [t('Resource'), crash.resource],
  ].filter(([, value]) => defined(value) && value !== '');

  return (
    <Container border="danger" radius="md" padding="lg">
      <Stack gap="lg">
        <Flex gap="sm" align="center">
          <IconWarning size="sm" />
          <Text bold>
            {isMemoryFault ? getCategoryLabel(crash.fault_category) : t('Faulted warp')}
          </Text>
          {crash.resource_destroyed ? (
            <Tag variant="danger">{t('Use-after-free')}</Tag>
          ) : null}
        </Flex>
        {fields.length ? (
          <Grid columns="repeat(auto-fit, minmax(180px, 1fr))" gap="md xl">
            {fields.map(([label, value]) => (
              <Stack key={label} gap="2xs">
                <Text size="xs" variant="muted" uppercase>
                  {label}
                </Text>
                <Text monospace>{String(value)}</Text>
              </Stack>
            ))}
          </Grid>
        ) : null}
        {warps.map((warp, i) => (
          <Stack key={i} gap="xs">
            <Flex gap="sm" align="center" wrap="wrap">
              <Tag variant="danger" icon={<IconFire size="xs" />}>
                {warp.fault_name ?? t('Faulted warp')}
              </Tag>
              {warp.pc ? (
                <Text size="sm" monospace>
                  {warp.pc}
                </Text>
              ) : null}
              {warp.shader_mapping?.File ? (
                <Text size="sm" monospace variant="muted">
                  {defined(warp.shader_mapping.Line)
                    ? `${warp.shader_mapping.File}:${warp.shader_mapping.Line}`
                    : warp.shader_mapping.File}
                </Text>
              ) : null}
            </Flex>
            {warp.fault_detail ? (
              <Text size="sm" variant="muted" wrap="pre-line">
                {warp.fault_detail}
              </Text>
            ) : null}
          </Stack>
        ))}
      </Stack>
    </Container>
  );
}

function LastOperation({marker, operation}: {operation: string; marker?: RawCrumb}) {
  const data = getMarkerData(marker);
  const meta = [
    data.Status,
    data.Pipe && t('%s of pipe', data.Pipe),
    data.Type && t('%s marker', data.Type),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Container background="secondary" border="accent" radius="md" padding="lg">
      <Stack gap="xs">
        <Flex gap="xs" align="center">
          <Text size="xs" variant="muted" uppercase>
            {t('Last GPU operation')}
          </Text>
          <InfoTip
            size="xs"
            title={t(
              'The innermost marker that was still executing when the GPU crashed.'
            )}
          />
        </Flex>
        <Text size="xl" bold monospace variant="accent">
          {operation}
        </Text>
        {meta ? (
          <Text size="xs" variant="muted">
            {meta}
          </Text>
        ) : null}
      </Stack>
    </Container>
  );
}

function Markers({crumbs}: {crumbs: RawCrumb[]}) {
  const markers = crumbs.filter(c => c.category === 'gpu.marker');
  const callstack =
    getMarkerData(crumbs.find(c => c.category === 'gpu.marker.callstack')).frames ?? [];
  if (!markers.length && !callstack.length) {
    return null;
  }
  return (
    <Grid columns="repeat(auto-fit, minmax(320px, 1fr))" gap="lg" align="start">
      {markers.length ? (
        <Container border="muted" radius="md" padding="md">
          <Stack gap="sm">
            <Flex gap="xs" align="center">
              <Text size="xs" bold uppercase variant="muted">
                {t('GPU markers')}
              </Text>
              <InfoTip
                size="xs"
                title={t(
                  'Markers the application recorded on the GPU command stream, with their state at the time of the crash.'
                )}
              />
            </Flex>
            {markers.map((marker, i) => {
              const data = getMarkerData(marker);
              return (
                <Flex key={i} gap="sm" align="center" wrap="wrap">
                  <Tag variant={markerVariant(data.Status)}>
                    {data.Status ?? t('Unknown')}
                  </Tag>
                  <Text monospace bold>
                    {marker.message}
                  </Text>
                  <Text size="xs" variant="muted">
                    {[data.Pipe && t('%s of pipe', data.Pipe), data.Type]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Flex>
              );
            })}
          </Stack>
        </Container>
      ) : null}
      {callstack.length ? (
        <Container border="muted" radius="md" padding="md">
          <Stack gap="sm">
            <Flex gap="xs" align="center">
              <Text size="xs" bold uppercase variant="muted">
                {t('Issued from (CPU callstack)')}
              </Text>
              <InfoTip
                size="xs"
                title={t(
                  'The CPU callstack that recorded the marker. Frames show module and address until the matching PDB is uploaded.'
                )}
              />
            </Flex>
            <Stack gap="0">
              {callstack.map((frame, i) => (
                <Text key={i} size="sm" monospace variant={frameVariant(frame)}>
                  {frame}
                </Text>
              ))}
            </Stack>
          </Stack>
        </Container>
      ) : null}
    </Grid>
  );
}

function DecodeDetails({crash}: {crash: GPUCrashContext}) {
  const warnings = crash.warnings ?? [];
  const details = [
    (crash.sdk_version || crash.handler) &&
      t('Decoded by %s', crash.sdk_version ?? crash.handler),
    defined(crash.decode_time_ms) &&
      t('in %s', getDuration(crash.decode_time_ms / 1000, 2, true)),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Stack gap="sm">
      {crash.missing_dif_count ? (
        <Alert variant="warning">
          {tn(
            '%s shader debug info file (.nvdbg) referenced by this crash was not uploaded, so shader names and source mapping may be incomplete.',
            '%s shader debug info files (.nvdbg) referenced by this crash were not uploaded, so shader names and source mapping may be incomplete.',
            crash.missing_dif_count
          )}
        </Alert>
      ) : null}
      {warnings.map((warning, i) => (
        <Alert key={i} variant="muted">
          {[warning.code, warning.message].filter(Boolean).join(': ')}
        </Alert>
      ))}
      <Flex gap="sm" align="center" wrap="wrap">
        {crash.status && crash.status !== 'completed' ? (
          <Tag variant={crash.status === 'failed' ? 'danger' : 'warning'}>
            {crash.status === 'failed' ? t('Decode failed') : t('Partial decode')}
          </Tag>
        ) : null}
        {details ? (
          <Text size="xs" variant="muted">
            {details}
          </Text>
        ) : null}
      </Flex>
    </Stack>
  );
}

export function EventGpuCrashReport({event}: {event: Event}) {
  let exceptions: ExceptionValue[] | undefined;
  let breadcrumbs: RawCrumb[] | undefined;
  for (const entry of event.entries ?? []) {
    if (entry.type === EntryType.EXCEPTION) {
      exceptions = entry.data.values;
    } else if (entry.type === EntryType.BREADCRUMBS) {
      breadcrumbs = entry.data.values;
    }
  }
  const value = exceptions?.find(v => v.mechanism?.type === 'gpu_crash');
  const {gpu_crash: crash, gpu, unreal, os, app} = event.contexts;
  if (!value || !crash) {
    return null;
  }

  const frame = value.stacktrace?.frames?.at(-1);
  const crumbs = (breadcrumbs ?? []).filter(c => c.category?.startsWith('gpu.'));
  const lastOperation = crash.last_gpu_operation;
  const operationMarkers = crumbs.filter(
    c => c.category === 'gpu.marker' && c.message === lastOperation
  );
  const lastMarker =
    operationMarkers.findLast(c => getMarkerData(c).Status === 'Executing') ??
    operationMarkers.at(-1);
  const annotations = crumbs
    .filter(c => c.category === 'gpu.application' || c.category === 'gpu.user_defined')
    .map(c => (c.message ?? '').split(/: (.*)/s));
  const crashFlags = [
    unreal?.is_ensure && t('Ensure'),
    unreal?.is_assert && t('Assert'),
    unreal?.is_stall && t('Stall'),
  ].filter(Boolean);

  return (
    <FoldSection sectionKey={SectionKey.GPU_CRASH_REPORT} title={t('GPU Crash Report')}>
      <Stack gap="xl">
        <Grid columns={lastOperation ? '1fr auto' : '1fr'} gap="xl" align="start">
          <Stack gap="md">
            <Text size="lg" density="comfortable">
              {getSummary(crash, frame?.function)}
            </Text>
            <Flex gap="xs" wrap="wrap">
              <Tag variant="danger">{getCategoryLabel(crash.fault_category)}</Tag>
              {crash.shader_type ? (
                <Tag variant="muted">{t('%s shader', crash.shader_type)}</Tag>
              ) : null}
              {gpu?.api_type ? <Tag variant="muted">{gpu.api_type}</Tag> : null}
              {gpu?.generation ? <Tag variant="muted">{gpu.generation}</Tag> : null}
              {unreal?.engine_version ? (
                <Tag variant="info">{t('Unreal Engine %s', unreal.engine_version)}</Tag>
              ) : null}
            </Flex>
          </Stack>
          {lastOperation ? (
            <LastOperation operation={lastOperation} marker={lastMarker} />
          ) : null}
        </Grid>

        <Container background="secondary" border="primary" radius="md" padding="lg">
          <Stack gap="lg">
            <Pipeline crash={crash} />
            <Flow steps={getFlow(crash)} />
          </Stack>
        </Container>

        <FaultPanel crash={crash} />

        <KeyValueTableCardGrid>
          <KeyValueTableCard
            title={t('Fault')}
            contentItems={rows([
              ['fault_category', t('Category'), getCategoryLabel(crash.fault_category)],
              ['fault_type', t('Type'), crash.fault_type],
              ['fault_code', t('Code'), crash.fault_code],
              ['device_status', t('Device status'), crash.device_status],
              ['device_state', t('Device state'), crash.device_state],
              ['engine_reset', t('Engine reset'), yesNo(crash.engine_reset)],
              ['adapter_reset', t('Adapter reset'), yesNo(crash.adapter_reset)],
              ['fault_description', t('Description'), crash.fault_description],
            ])}
          />
          <KeyValueTableCard
            title={
              HANGS.has(crash.fault_category) ? t('Where it hung') : t('Where it faulted')
            }
            contentItems={rows([
              ['shader', t('Shader'), frame?.function],
              ['shader_type', t('Stage'), crash.shader_type],
              ['shader_hash', t('Shader hash'), crash.shader_hash],
              [
                'faulting_pc',
                t('Program counter'),
                crash.faulting_pc ?? frame?.instructionAddr,
              ],
              ['active_warps', t('Warps in flight'), crash.active_warps],
              [
                'source',
                t('Source'),
                frame?.filename && defined(frame.lineNo)
                  ? `${frame.filename}:${frame.lineNo}`
                  : frame?.filename,
              ],
              ['shader_debug_info_uid', t('Debug info UID'), crash.shader_debug_info_uid],
              [
                'shader_size',
                t('Shader size'),
                defined(crash.shader_size)
                  ? formatBytesBase2(crash.shader_size)
                  : undefined,
              ],
            ])}
          />
          <KeyValueTableCard
            title={t('GPU & Environment')}
            contentItems={rows([
              ['gpu', t('GPU'), gpu?.brand ?? gpu?.name],
              ['chip', t('Chip'), gpu?.brand ? gpu?.name : undefined],
              ['generation', t('Architecture'), gpu?.generation],
              ['driver', t('Driver'), gpu?.driver_version],
              ['api', t('Graphics API'), gpu?.api_type],
              ['os', t('Operating system'), os?.raw_description ?? unreal?.os],
              ['cpu', t('CPU'), unreal?.cpu_brand],
              [
                'memory',
                t('System memory'),
                defined(unreal?.total_ram_gb)
                  ? t('%s GB', unreal?.total_ram_gb)
                  : undefined,
              ],
              ['app', t('Application'), app?.app_name],
            ])}
          />
          {unreal ? (
            <KeyValueTableCard
              title={t('Unreal Engine')}
              contentItems={rows([
                ['game', t('Game'), unreal.game],
                ['engine_version', t('Engine version'), unreal.engine_version],
                ['build_version', t('Build'), unreal.build_version],
                ['build_config', t('Configuration'), unreal.build_config],
                ['platform', t('Platform'), unreal.platform],
                ['engine_mode', t('Mode'), unreal.engine_mode],
                ['crash_type', t('Crash type'), unreal.crash_type],
                ['error_message', t('Error'), unreal.error_message],
                [
                  'seconds_since_start',
                  t('Uptime'),
                  typeof unreal.seconds_since_start === 'number'
                    ? getDuration(unreal.seconds_since_start, 0, true)
                    : unreal.seconds_since_start,
                ],
                [
                  'flags',
                  t('Crash flags'),
                  crashFlags.length ? crashFlags.join(', ') : t('None'),
                ],
              ])}
            />
          ) : null}
          {annotations.length ? (
            <KeyValueTableCard
              title={t('Application Data')}
              contentItems={rows(
                annotations.map(([key = '', text], i) => [
                  `${key}-${i}`,
                  key,
                  text ?? key,
                ])
              )}
            />
          ) : null}
        </KeyValueTableCardGrid>

        <Markers crumbs={crumbs} />

        <DecodeDetails crash={crash} />
      </Stack>
    </FoldSection>
  );
}
