import {IconAdd} from '@sentry/icons/add';
import {IconDelete} from '@sentry/icons/delete';
import {IconSettings} from '@sentry/icons/settings';

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
  type TransformationAnalyticsSource,
} from 'sentry/utils/analytics/exploreAnalyticsEvents';
import {parseFunction} from 'sentry/utils/discover/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TraceItemDataset} from 'sentry/views/explore/types';

type FillMethod = 'zero' | 'locf' | 'linear';
type SmoothMethod = 'sma' | 'ema' | 'asap';
type TransformationLayout = 'stacked' | 'inline';
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
  {
    value: 'zero',
    label: t('Zero'),
    details: t('Fills missing values with zero.'),
  },
  {
    value: 'locf',
    label: t('LOCF'),
    details: t('Last observation carried forward. Fills gaps with the last known value.'),
  },
  {
    value: 'linear',
    label: t('Linear'),
    details: t('Fills gaps along a straight line between known values.'),
  },
];
const SMOOTH_OPTIONS: Array<SelectOption<SmoothMethod>> = [
  {
    value: 'sma',
    label: t('SMA'),
    details: t('Simple moving average. Gives equal weight to values in the window.'),
  },
  {
    value: 'ema',
    label: t('EMA'),
    details: t('Exponential moving average. Gives more weight to recent values.'),
  },
  {
    value: 'asap',
    label: t('ASAP'),
    details: t('Automatically chooses a smoothing window to reduce noise.'),
  },
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
  ema: {kind: 'smooth', method: 'ema', window: 10},
  asap: {kind: 'smooth', method: 'asap'},
};

interface Props {
  onChange: (transformations: readonly string[]) => void;
  traceItemDataset:
    | TraceItemDataset.SPANS
    | TraceItemDataset.LOGS
    | TraceItemDataset.TRACEMETRICS;
  transformations: readonly string[];
  analyticsSource?: TransformationAnalyticsSource;
}

interface TransformationRowsProps extends Props {
  layout?: TransformationLayout;
}

export function VisualizeTransformationRows({
  transformations,
  onChange,
  traceItemDataset,
  layout = 'stacked',
  analyticsSource = 'explore',
}: TransformationRowsProps) {
  const organization = useOrganization();

  return transformations.length ? (
    <Stack gap="sm">
      {transformations.map((raw, index) => {
        const transformation = parseTransformation(raw);
        return (
          <TransformationRow
            key={`${parseFunction(raw)?.name ?? 'unsupported'}-${index}`}
            transformation={transformation}
            index={index}
            traceItemDataset={traceItemDataset}
            analyticsSource={analyticsSource}
            layout={layout}
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
                source: analyticsSource,
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
    </Stack>
  ) : null;
}

interface AddTransformationButtonProps extends Props {
  iconOnly?: boolean;
}

export function AddTransformationButton({
  transformations,
  onChange,
  traceItemDataset,
  iconOnly = false,
  analyticsSource = 'explore',
}: AddTransformationButtonProps) {
  const organization = useOrganization();
  const kindOptions = KIND_OPTIONS.map(option => ({
    ...option,
    disabled: transformations.some(raw => parseFunction(raw)?.name === option.value),
  }));

  return (
    <CompactSelect
      options={kindOptions}
      disabled={transformations.length >= KIND_OPTIONS.length}
      value={undefined}
      trigger={props =>
        iconOnly ? (
          <OverlayTrigger.IconButton
            {...props}
            variant="transparent"
            size="zero"
            icon={<IconSettings />}
            aria-label={t('Add Transformation')}
            tooltipProps={{title: t('Add Transformation')}}
          />
        ) : (
          <OverlayTrigger.Button
            {...props}
            variant="transparent"
            size="zero"
            icon={<IconAdd />}
          >
            {t('Add Transformation')}
          </OverlayTrigger.Button>
        )
      }
      onChange={({value}) => {
        trackAnalytics('explore.visualize.transformation.added', {
          organization,
          source: analyticsSource,
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
  );
}

interface TransformationRowProps {
  analyticsSource: TransformationAnalyticsSource;
  index: number;
  layout: TransformationLayout;
  onChange: (value: Transformation) => void;
  onRemove: () => void;
  onTypeChange: (kind: Transformation['kind']) => void;
  traceItemDataset: Props['traceItemDataset'];
  transformation: Transformation | null;
}

function TransformationRow({
  analyticsSource,
  index,
  layout,
  onChange,
  onRemove,
  onTypeChange,
  traceItemDataset,
  transformation,
}: TransformationRowProps) {
  const organization = useOrganization();
  const analyticsParams = {
    source: analyticsSource,
    traceItemDataset,
    transformation_index: index,
  };
  const removalAnalyticsParams = {
    ...analyticsParams,
    transformation_type: transformation?.kind ?? 'unsupported',
  } satisfies Omit<
    ExploreAnalyticsEventParameters['explore.visualize.transformation.removed'],
    'organization'
  >;
  return (
    <Stack role="group" aria-label={t('Transformation %s', index + 1)} gap="sm">
      <Flex align="center" gap="md">
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
        <Flex align="center" gap="md" wrap="wrap" minWidth="0">
          {transformation ? (
            <PageFilterBar condensed>
              <CompactSelect
                options={KIND_OPTIONS}
                value={transformation.kind}
                trigger={props => (
                  <OverlayTrigger.Button
                    {...props}
                    aria-label={t('Transformation type')}
                  />
                )}
                onChange={({value}) => onTypeChange(value)}
              />
              {transformation.kind === 'fill' ? (
                <CompactSelect
                  options={FILL_OPTIONS}
                  menuWidth={320}
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
                  menuWidth={320}
                  value={transformation.method}
                  trigger={props => (
                    <OverlayTrigger.Button
                      {...props}
                      aria-label={t('Smoothing method')}
                    />
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
          {layout === 'inline' && transformation?.kind === 'smooth' ? (
            <SmoothingSettings
              transformation={transformation}
              analyticsSource={analyticsSource}
              index={index}
              traceItemDataset={traceItemDataset}
              layout={layout}
              onChange={onChange}
            />
          ) : null}
        </Flex>
      </Flex>
      {layout === 'stacked' && transformation?.kind === 'smooth' ? (
        <SmoothingSettings
          transformation={transformation}
          analyticsSource={analyticsSource}
          index={index}
          traceItemDataset={traceItemDataset}
          layout={layout}
          onChange={onChange}
        />
      ) : null}
    </Stack>
  );
}

interface SmoothingSettingsProps {
  analyticsSource: TransformationAnalyticsSource;
  index: number;
  layout: TransformationLayout;
  onChange: (value: SmoothTransformation) => void;
  traceItemDataset: Props['traceItemDataset'];
  transformation: SmoothTransformation;
}

function SmoothingSettings({
  analyticsSource,
  index,
  layout,
  onChange,
  traceItemDataset,
  transformation,
}: SmoothingSettingsProps) {
  const organization = useOrganization();
  const analyticsParams = {
    source: analyticsSource,
    traceItemDataset,
    transformation_index: index,
  };
  const windowLabel =
    transformation.method === 'asap' ? t('Max Window Size') : t('Window Size');
  return (
    <Flex gap="md" wrap="wrap">
      <Flex
        direction={layout === 'inline' ? 'row' : 'column'}
        align={layout === 'inline' ? 'center' : 'stretch'}
        gap="xs"
      >
        <Text size="sm" wrap="nowrap">
          {windowLabel}
        </Text>
        <CompactSelect
          options={WINDOW_OPTIONS}
          value={transformation.window}
          clearable={transformation.method === 'asap'}
          multiple={false}
          disabled={
            transformation.method === 'ema' && transformation.factor !== undefined
          }
          trigger={props => (
            <OverlayTrigger.Button {...props} aria-label={windowLabel}>
              {transformation.window === undefined ? t('Auto') : props.children}
            </OverlayTrigger.Button>
          )}
          onChange={(option: SelectOption<number> | undefined) => {
            const window = option?.value;
            if (window !== transformation.window) {
              trackAnalytics('explore.visualize.transformation.window_changed', {
                organization,
                ...analyticsParams,
                method: transformation.method,
                window: window ?? null,
              });
            }
            if (transformation.method === 'asap') {
              onChange({...transformation, window});
            } else if (window !== undefined) {
              onChange({...transformation, window});
            }
          }}
        />
      </Flex>
      {transformation.method === 'ema' && (
        <Flex
          direction={layout === 'inline' ? 'row' : 'column'}
          align={layout === 'inline' ? 'center' : 'stretch'}
          gap="xs"
        >
          <Text size="sm" wrap="nowrap">
            {t('Smoothing Weight')}
          </Text>
          <CompactSelect
            options={FACTOR_OPTIONS}
            value={transformation.factor}
            clearable
            trigger={props => (
              <OverlayTrigger.Button {...props} aria-label={t('Smoothing Weight')}>
                {transformation.factor === undefined ? t('Auto') : props.children}
              </OverlayTrigger.Button>
            )}
            onChange={option => {
              const factor = option?.value;
              if (factor !== transformation.factor) {
                trackAnalytics('explore.visualize.transformation.factor_changed', {
                  organization,
                  ...analyticsParams,
                  factor: factor ?? null,
                });
              }
              onChange({...transformation, factor});
            }}
          />
        </Flex>
      )}
    </Flex>
  );
}
