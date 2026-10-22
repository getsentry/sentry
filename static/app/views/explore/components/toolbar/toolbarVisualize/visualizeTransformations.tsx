import {IconAdd} from '@sentry/icons/add';
import {IconDelete} from '@sentry/icons/delete';

import {Button} from '@sentry/scraps/button';
import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  exploreAnalyticsEventMap,
  type ExploreAnalyticsEventParameters,
} from 'sentry/utils/analytics/exploreAnalyticsEvents';
import {parseFunction} from 'sentry/utils/discover/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TraceItemDataset} from 'sentry/views/explore/types';

type FillMethod = 'zero' | 'locf' | 'linear';
type SmoothMethod = 'sma' | 'ema' | 'asap';
type Transformation =
  | {kind: 'fill'; method: FillMethod}
  | {kind: 'smooth'; method: 'sma'; window: number}
  | {kind: 'smooth'; method: 'ema'; window: number; factor?: number}
  | {kind: 'smooth'; method: 'asap'; window?: number};

const KIND_OPTIONS: Array<SelectOption<Transformation['kind']>> = [
  {value: 'fill', label: t('Fill')},
  {value: 'smooth', label: t('Smooth')},
];
const FILL_OPTIONS: Array<SelectOption<FillMethod>> = [
  {value: 'zero', label: t('Zero')},
  {value: 'locf', label: t('LOCF')},
  {value: 'linear', label: t('Linear')},
];
const SMOOTH_OPTIONS: Array<SelectOption<SmoothMethod>> = [
  {value: 'sma', label: t('SMA')},
  {value: 'ema', label: t('EMA')},
  {value: 'asap', label: t('ASAP')},
];
const WINDOW_OPTIONS = Array.from({length: 10}, (_, index) => ({
  value: index + 1,
  label: String(index + 1),
}));
const FACTOR_OPTIONS = [0.05, 0.25, 0.5, 0.75, 1].map(value => ({
  value,
  label: `${value * 100}%`,
}));

function parseTransformation(raw: string): Transformation | null {
  const parsedFunction = parseFunction(raw);
  if (
    !parsedFunction ||
    !KIND_OPTIONS.some(option => option.value === parsedFunction.name)
  ) {
    return null;
  }
  const args = parsedFunction.arguments;
  const method = args[0];
  if (parsedFunction.name === 'fill') {
    const option = FILL_OPTIONS.find(candidate => candidate.value === method);
    return args.length === 1 && option ? {kind: 'fill', method: option.value} : null;
  }
  if (method === 'asap' && args.length === 1) {
    return {kind: 'smooth', method};
  }
  const window = Number(args[1]);
  if (!WINDOW_OPTIONS.some(option => option.value === window)) {
    return null;
  }
  if ((method === 'sma' || method === 'asap') && args.length === 2) {
    return {kind: 'smooth', method, window};
  }
  if (method === 'ema') {
    if (args.length === 2) {
      return {kind: 'smooth', method, window};
    }
    const factor = Number(args[2]);
    if (args.length === 3 && FACTOR_OPTIONS.some(option => option.value === factor)) {
      return {kind: 'smooth', method, window, factor};
    }
  }
  return null;
}

function formatTransformation(value: Transformation): string {
  if (value.kind === 'fill') {
    return `fill(${value.method})`;
  }
  const args: Array<string | number> = [value.method];
  if (value.window !== undefined) {
    args.push(value.window);
  }
  if (value.method === 'ema' && value.factor !== undefined) {
    args.push(value.factor);
  }
  return `smooth(${args.join(',')})`;
}

type SmoothTransformation = Extract<Transformation, {kind: 'smooth'}>;

const SMOOTH_DEFAULTS: Record<SmoothMethod, SmoothTransformation> = {
  sma: {kind: 'smooth', method: 'sma', window: 3},
  ema: {kind: 'smooth', method: 'ema', window: 10, factor: 0.25},
  asap: {kind: 'smooth', method: 'asap', window: 5},
};

interface Props {
  onChange: (transformations: readonly string[]) => void;
  traceItemDataset: TraceItemDataset.SPANS | TraceItemDataset.LOGS;
  transformations: readonly string[];
}

export function VisualizeTransformations({
  transformations,
  onChange,
  traceItemDataset,
}: Props) {
  const organization = useOrganization();
  const kindOptions = KIND_OPTIONS.map(option => ({
    ...option,
    disabled: transformations.some(raw => parseFunction(raw)?.name === option.value),
  }));

  return (
    <Stack gap="sm">
      {transformations.map((raw, index) => {
        const transformation = parseTransformation(raw);
        return (
          <TransformationRow
            key={`${parseFunction(raw)?.name ?? 'unsupported'}-${index}`}
            transformation={transformation}
            index={index}
            traceItemDataset={traceItemDataset}
            onChange={value =>
              onChange(transformations.toSpliced(index, 1, formatTransformation(value)))
            }
            onRemove={() => onChange(transformations.toSpliced(index, 1))}
            onTypeChange={kind => {
              if (!transformation || kind === transformation.kind) {
                return;
              }
              const analyticsParams = {
                organization,
                traceItemDataset,
                transformation_index: index,
              };
              const otherIndex = transformations.findIndex(
                (candidate, candidateIndex) =>
                  candidateIndex !== index && parseFunction(candidate)?.name === kind
              );
              const otherTransformation = transformations[otherIndex];
              if (otherTransformation !== undefined) {
                trackAnalytics('explore.visualize.transformation.reordered', {
                  ...analyticsParams,
                  transformation_type: transformation.kind,
                  target_type: kind,
                  target_index: otherIndex,
                });
                onChange(
                  transformations
                    .toSpliced(index, 1, otherTransformation)
                    .toSpliced(otherIndex, 1, raw)
                );
                return;
              }
              trackAnalytics('explore.visualize.transformation.type_changed', {
                ...analyticsParams,
                previous_type: transformation.kind,
                transformation_type: kind,
              });
              onChange(
                transformations.toSpliced(
                  index,
                  1,
                  formatTransformation(
                    kind === 'fill' ? {kind: 'fill', method: 'zero'} : SMOOTH_DEFAULTS.sma
                  )
                )
              );
            }}
          />
        );
      })}
      <CompactSelect
        options={kindOptions}
        disabled={transformations.length >= KIND_OPTIONS.length}
        value={undefined}
        trigger={props => (
          <OverlayTrigger.Button {...props} variant="link" size="zero" icon={<IconAdd />}>
            {t('Add Transformation')}
          </OverlayTrigger.Button>
        )}
        onChange={({value}) => {
          trackAnalytics('explore.visualize.transformation.added', {
            organization,
            traceItemDataset,
            transformation_index: transformations.length,
            transformation_type: value,
          });
          onChange([
            ...transformations,
            formatTransformation(
              value === 'fill' ? {kind: 'fill', method: 'zero'} : SMOOTH_DEFAULTS.sma
            ),
          ]);
        }}
      />
    </Stack>
  );
}

interface TransformationRowProps {
  index: number;
  onChange: (value: Transformation) => void;
  onRemove: () => void;
  onTypeChange: (kind: Transformation['kind']) => void;
  traceItemDataset: Props['traceItemDataset'];
  transformation: Transformation | null;
}

function TransformationRow({
  index,
  onChange,
  onRemove,
  onTypeChange,
  traceItemDataset,
  transformation,
}: TransformationRowProps) {
  const organization = useOrganization();
  const analyticsParams = {traceItemDataset, transformation_index: index};
  const removalAnalyticsParams = {
    ...analyticsParams,
    transformation_type: transformation?.kind ?? 'unsupported',
  } satisfies Omit<
    ExploreAnalyticsEventParameters['explore.visualize.transformation.removed'],
    'organization'
  >;
  return (
    <Stack
      role="group"
      aria-label={t('Transformation %s', index + 1)}
      gap="sm"
      padding="md"
      background="secondary"
      radius="md"
    >
      <Flex align="center" justify="between" gap="sm">
        {transformation ? (
          <PageFilterBar condensed>
            <CompactSelect
              options={KIND_OPTIONS}
              value={transformation.kind}
              trigger={props => (
                <OverlayTrigger.Button {...props} aria-label={t('Transformation type')} />
              )}
              onChange={({value}) => onTypeChange(value)}
            />
            {transformation.kind === 'fill' ? (
              <CompactSelect
                options={FILL_OPTIONS}
                value={transformation.method}
                trigger={props => (
                  <OverlayTrigger.Button {...props} aria-label={t('Fill method')} />
                )}
                onChange={({value}) => {
                  if (value !== transformation.method) {
                    trackAnalytics('explore.visualize.transformation.method_changed', {
                      organization,
                      ...analyticsParams,
                      transformation_type: 'fill',
                      method: value,
                    });
                  }
                  onChange({...transformation, method: value});
                }}
              />
            ) : (
              <CompactSelect
                options={SMOOTH_OPTIONS}
                value={transformation.method}
                trigger={props => (
                  <OverlayTrigger.Button {...props} aria-label={t('Smoothing method')} />
                )}
                onChange={({value}) => {
                  if (value !== transformation.method) {
                    trackAnalytics('explore.visualize.transformation.method_changed', {
                      organization,
                      ...analyticsParams,
                      transformation_type: 'smooth',
                      method: value,
                    });
                    onChange(
                      value === 'asap' || transformation.method === 'asap'
                        ? SMOOTH_DEFAULTS[value]
                        : {...SMOOTH_DEFAULTS[value], window: transformation.window}
                    );
                  }
                }}
              />
            )}
          </PageFilterBar>
        ) : (
          <Text size="sm">{t('Unsupported transformation')}</Text>
        )}
        <Button
          variant="transparent"
          size="zero"
          icon={<IconDelete size="sm" />}
          aria-label={t('Remove transformation')}
          analyticsEventKey="explore.visualize.transformation.removed"
          analyticsEventName={
            exploreAnalyticsEventMap['explore.visualize.transformation.removed']
          }
          analyticsParams={removalAnalyticsParams}
          onClick={onRemove}
        />
      </Flex>
      {transformation?.kind === 'smooth' && (
        <SmoothingSettings
          transformation={transformation}
          index={index}
          traceItemDataset={traceItemDataset}
          onChange={onChange}
        />
      )}
    </Stack>
  );
}

interface SmoothingSettingsProps {
  index: number;
  onChange: (value: SmoothTransformation) => void;
  traceItemDataset: Props['traceItemDataset'];
  transformation: SmoothTransformation;
}

function SmoothingSettings({
  index,
  onChange,
  traceItemDataset,
  transformation,
}: SmoothingSettingsProps) {
  const organization = useOrganization();
  const analyticsParams = {traceItemDataset, transformation_index: index};
  const windowLabel =
    transformation.method === 'asap' ? t('Max Window Size') : t('Window Size');
  return (
    <Flex gap="md" wrap="wrap">
      <Stack gap="xs">
        <Text size="sm">{windowLabel}</Text>
        <CompactSelect
          options={WINDOW_OPTIONS}
          value={transformation.window}
          trigger={props => (
            <OverlayTrigger.Button {...props} aria-label={windowLabel}>
              {transformation.window === undefined ? t('Auto') : props.children}
            </OverlayTrigger.Button>
          )}
          onChange={({value}) => {
            if (value !== transformation.window) {
              trackAnalytics('explore.visualize.transformation.window_changed', {
                organization,
                ...analyticsParams,
                method: transformation.method,
                window: value,
              });
            }
            onChange({...transformation, window: value});
          }}
        />
      </Stack>
      {transformation.method === 'ema' && (
        <Stack gap="xs">
          <Text size="sm">{t('Smoothing Factor')}</Text>
          <CompactSelect
            options={FACTOR_OPTIONS}
            value={transformation.factor}
            trigger={props => (
              <OverlayTrigger.Button {...props} aria-label={t('Smoothing Factor')}>
                {transformation.factor === undefined ? t('Auto') : props.children}
              </OverlayTrigger.Button>
            )}
            onChange={({value}) => {
              if (value !== transformation.factor) {
                trackAnalytics('explore.visualize.transformation.factor_changed', {
                  organization,
                  ...analyticsParams,
                  factor: value,
                });
              }
              onChange({...transformation, factor: value});
            }}
          />
        </Stack>
      )}
    </Flex>
  );
}
