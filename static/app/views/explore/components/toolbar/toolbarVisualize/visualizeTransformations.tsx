import {IconAdd} from '@sentry/icons/add';
import {IconDelete} from '@sentry/icons/delete';

import {Button} from '@sentry/scraps/button';
import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

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
  {value: 'locf', label: t('Previous value')},
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
  const match = /^(fill|smooth)\(([^()]*)\)$/.exec(raw);
  if (!match) {
    return null;
  }
  const args = match[2]!.split(',').map(argument => argument.trim());
  const method = args[0];
  if (match[1] === 'fill') {
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

function serializeTransformation(value: Transformation): string {
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

function defaultSmooth(method: SmoothMethod, window = 10): Transformation {
  return method === 'ema'
    ? {kind: 'smooth', method, window, factor: 0.25}
    : {kind: 'smooth', method, window};
}

interface Props {
  onChange: (transformations: readonly string[]) => void;
  transformations: readonly string[];
}

export function VisualizeTransformations({transformations, onChange}: Props) {
  const organization = useOrganization();
  if (!organization.features.includes('explore-interpolation-and-smoothing')) {
    return null;
  }

  return (
    <Stack gap="sm">
      {transformations.map((raw, index) => {
        const transformation = parseTransformation(raw);
        const replace = (value: Transformation) =>
          onChange(transformations.toSpliced(index, 1, serializeTransformation(value)));

        return (
          <Stack
            key={index}
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
                      <OverlayTrigger.Button
                        {...props}
                        aria-label={t('Transformation type')}
                      />
                    )}
                    onChange={({value}) => {
                      if (value !== transformation.kind) {
                        replace(
                          value === 'fill'
                            ? {kind: 'fill', method: 'zero'}
                            : defaultSmooth('sma')
                        );
                      }
                    }}
                  />
                  {transformation.kind === 'fill' ? (
                    <CompactSelect
                      options={FILL_OPTIONS}
                      value={transformation.method}
                      trigger={props => (
                        <OverlayTrigger.Button {...props} aria-label={t('Fill method')} />
                      )}
                      onChange={({value}) => replace({...transformation, method: value})}
                    />
                  ) : (
                    <CompactSelect
                      options={SMOOTH_OPTIONS}
                      value={transformation.method}
                      trigger={props => (
                        <OverlayTrigger.Button
                          {...props}
                          aria-label={t('Smoothing method')}
                        />
                      )}
                      onChange={({value}) => {
                        if (value !== transformation.method) {
                          replace(defaultSmooth(value, transformation.window));
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
                onClick={() => onChange(transformations.toSpliced(index, 1))}
              />
            </Flex>
            {transformation?.kind === 'smooth' && (
              <Flex gap="md" wrap="wrap">
                <Stack gap="xs">
                  <Text size="sm">
                    {transformation.method === 'asap'
                      ? t('Max Window Size')
                      : t('Window Size')}
                  </Text>
                  <CompactSelect
                    options={WINDOW_OPTIONS}
                    value={transformation.window}
                    trigger={props => (
                      <OverlayTrigger.Button
                        {...props}
                        aria-label={
                          transformation.method === 'asap'
                            ? t('Max Window Size')
                            : t('Window Size')
                        }
                      >
                        {transformation.window === undefined ? t('Auto') : props.children}
                      </OverlayTrigger.Button>
                    )}
                    onChange={({value}) => replace({...transformation, window: value})}
                  />
                </Stack>
                {transformation.method === 'ema' && (
                  <Stack gap="xs">
                    <Text size="sm">{t('Smoothing Factor')}</Text>
                    <CompactSelect
                      options={FACTOR_OPTIONS}
                      value={transformation.factor}
                      trigger={props => (
                        <OverlayTrigger.Button
                          {...props}
                          aria-label={t('Smoothing Factor')}
                        >
                          {transformation.factor === undefined
                            ? t('Auto')
                            : props.children}
                        </OverlayTrigger.Button>
                      )}
                      onChange={({value}) => replace({...transformation, factor: value})}
                    />
                  </Stack>
                )}
              </Flex>
            )}
          </Stack>
        );
      })}
      <CompactSelect
        options={KIND_OPTIONS}
        value={undefined}
        trigger={props => (
          <OverlayTrigger.Button {...props} variant="link" size="zero" icon={<IconAdd />}>
            {t('Add Transformation')}
          </OverlayTrigger.Button>
        )}
        onChange={({value}) =>
          onChange([
            ...transformations,
            serializeTransformation(
              value === 'fill' ? {kind: 'fill', method: 'zero'} : defaultSmooth('sma')
            ),
          ])
        }
      />
    </Stack>
  );
}
