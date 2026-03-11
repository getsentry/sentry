import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FocusScope} from '@react-aria/focus';
import {useVirtualizer} from '@tanstack/react-virtual';

import {Tag} from '@sentry/scraps/badge';
import {LeadWrap} from '@sentry/scraps/compactSelect';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {MenuListItem} from '@sentry/scraps/menuListItem';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconCheckmark, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useOverlay} from 'sentry/utils/useOverlay';
import {usePrevious} from 'sentry/utils/usePrevious';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import {useHasMetricUnitsUI} from 'sentry/views/explore/metrics/hooks/useHasMetricUnitsUI';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {canUseMetricsSidePanelUI} from 'sentry/views/explore/metrics/metricsFlags';
import {MetricTypeBadge} from 'sentry/views/explore/metrics/metricToolbar/metricOptionLabel';
import {
  TraceMetricKnownFieldKey,
  type TraceMetricTypeValue,
} from 'sentry/views/explore/metrics/types';

export const NONE_UNIT = 'none';

interface MetricSelectOption {
  label: string;
  metricName: string;
  metricType: TraceMetricTypeValue;
  value: string;
  metricUnit?: string;
}

export function MetricSelector({
  traceMetric,
  onChange,
}: {
  onChange: (traceMetric: TraceMetric) => void;
  traceMetric: TraceMetric;
}) {
  const organization = useOrganization();
  const [searchInputValue, setSearchInputValue] = useState('');
  const debouncedSearch = useDebouncedValue(searchInputValue, DEFAULT_DEBOUNCE_DURATION);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const {data: metricOptionsData, isFetching} = useMetricOptions({
    search: debouncedSearch,
  });
  const hasMetricUnitsUI = useHasMetricUnitsUI();
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const {
    isOpen,
    state: overlayState,
    triggerProps,
    overlayProps,
  } = useOverlay({
    type: 'listbox',
    position: 'bottom-start',
    offset: 6,
    isDismissable: true,
    shouldApplyMinWidth: true,
    onOpenChange: open => {
      if (!open) {
        setSearchInputValue('');
        setFocusedIndex(-1);
      }
    },
  });

  const metricSelectValue = makeMetricSelectValue(
    hasMetricUnitsUI ? traceMetric : {name: traceMetric.name, type: traceMetric.type}
  );
  const optionFromTraceMetric: MetricSelectOption = useMemo(
    () => ({
      label: traceMetric.name,
      value: metricSelectValue,
      metricType: traceMetric.type as TraceMetricTypeValue,
      metricUnit: hasMetricUnitsUI ? (traceMetric.unit ?? '-') : undefined,
      metricName: traceMetric.name,
    }),
    [
      metricSelectValue,
      traceMetric.name,
      traceMetric.type,
      traceMetric.unit,
      hasMetricUnitsUI,
    ]
  );

  const metricOptions = useMemo((): MetricSelectOption[] => {
    const shouldIncludeOptionFromTraceMetric =
      traceMetric.name &&
      !metricOptionsData?.data?.some(
        option =>
          makeMetricSelectValue({
            name: option[TraceMetricKnownFieldKey.METRIC_NAME],
            type: option[TraceMetricKnownFieldKey.METRIC_TYPE],
            unit: hasMetricUnitsUI
              ? (option[TraceMetricKnownFieldKey.METRIC_UNIT] ?? NONE_UNIT)
              : undefined,
          }) === makeMetricSelectValue(traceMetric)
      );
    return [
      ...(shouldIncludeOptionFromTraceMetric ? [optionFromTraceMetric] : []),
      ...(metricOptionsData?.data?.map(option => ({
        label: option[TraceMetricKnownFieldKey.METRIC_NAME],
        value: makeMetricSelectValue({
          name: option[TraceMetricKnownFieldKey.METRIC_NAME],
          type: option[TraceMetricKnownFieldKey.METRIC_TYPE] as TraceMetricTypeValue,
          unit: hasMetricUnitsUI
            ? (option[TraceMetricKnownFieldKey.METRIC_UNIT] ?? NONE_UNIT)
            : undefined,
        }),
        metricType: option[TraceMetricKnownFieldKey.METRIC_TYPE],
        metricName: option[TraceMetricKnownFieldKey.METRIC_NAME],
        metricUnit: hasMetricUnitsUI
          ? (option[TraceMetricKnownFieldKey.METRIC_UNIT] ?? NONE_UNIT)
          : undefined,
        trailingItems: () => (
          <Fragment>
            <MetricTypeBadge metricType={option[TraceMetricKnownFieldKey.METRIC_TYPE]} />
            {hasMetricUnitsUI &&
              option[TraceMetricKnownFieldKey.METRIC_UNIT] &&
              option[TraceMetricKnownFieldKey.METRIC_UNIT] !== NONE_UNIT && (
                <Tag variant="promotion">
                  {option[TraceMetricKnownFieldKey.METRIC_UNIT]}
                </Tag>
              )}
          </Fragment>
        ),
      })) ?? []),
    ];
  }, [metricOptionsData, optionFromTraceMetric, traceMetric, hasMetricUnitsUI]);

  useEffect(() => {
    if (metricOptions.length && metricOptions[0] && !traceMetric.name) {
      onChange({
        name: metricOptions[0].metricName,
        type: metricOptions[0].metricType,
        unit: hasMetricUnitsUI ? (metricOptions[0].metricUnit ?? NONE_UNIT) : undefined,
      });
    }
  }, [metricOptions, onChange, traceMetric.name, hasMetricUnitsUI]);

  const traceMetricSelectValue = makeMetricSelectValue(
    hasMetricUnitsUI ? traceMetric : {name: traceMetric.name, type: traceMetric.type}
  );
  const previousOptions = usePrevious(metricOptions ?? []);
  const displayedOptions = useMemo(
    () => (isFetching ? previousOptions : (metricOptions ?? [])),
    [isFetching, previousOptions, metricOptions]
  );

  useEffect(() => {
    if (displayedOptions.length === 0) {
      return;
    }

    if (focusedIndex < displayedOptions.length) {
      return;
    }

    setFocusedIndex(Math.max(displayedOptions.length - 1, -1));
  }, [displayedOptions.length, focusedIndex]);

  const longestOption = useMemo(
    () =>
      displayedOptions.reduce<MetricSelectOption | null>(
        (longest, option) =>
          !longest || option.label.length > longest.label.length ? option : longest,
        null
      ),
    [displayedOptions]
  );

  const virtualizer = useVirtualizer({
    count: displayedOptions.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => 42,
    overscan: 20,
  });

  const highlightedOption =
    focusedIndex >= 0 && focusedIndex < displayedOptions.length
      ? displayedOptions[focusedIndex]
      : null;

  const handleSelect = useCallback(
    (option: MetricSelectOption) => {
      onChange({
        name: option.metricName,
        type: option.metricType,
        unit: hasMetricUnitsUI ? option.metricUnit : undefined,
      });
      overlayState.close();
    },
    [onChange, hasMetricUnitsUI, overlayState]
  );

  const onSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInputValue(e.target.value);
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (displayedOptions.length === 0) {
            break;
          }
          const next = Math.min(focusedIndex + 1, displayedOptions.length - 1);
          setFocusedIndex(next);
          virtualizer.scrollToIndex(next);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (displayedOptions.length === 0) {
            break;
          }
          const next = Math.max(focusedIndex - 1, 0);
          setFocusedIndex(next);
          virtualizer.scrollToIndex(next);
          break;
        }
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && displayedOptions[focusedIndex]) {
            handleSelect(displayedOptions[focusedIndex]);
          }
          break;
        default:
          break;
      }
    },
    [displayedOptions, focusedIndex, handleSelect, virtualizer]
  );

  const virtualItems = virtualizer.getVirtualItems();
  // Fall back to rendering all items when the virtualizer can't measure the scroll
  // container (e.g. in test environments where DOM has no layout dimensions).
  const itemsToRender =
    virtualItems.length > 0 || displayedOptions.length === 0
      ? virtualItems
      : displayedOptions.map((_, index) => ({
          index,
          key: index,
          start: 0,
          end: 0,
          size: 42,
          lane: 0,
        }));

  return (
    <Container width="100%" position="relative">
      <OverlayTrigger.Button
        {...triggerProps}
        style={{width: '100%', fontWeight: 'bold', textAlign: 'left'}}
        disabled={isFetching && !traceMetric.name}
      >
        <Text ellipsis>{traceMetric.name || t('None')}</Text>
      </OverlayTrigger.Button>
      <PositionWrapper
        zIndex={1001}
        {...overlayProps}
        style={{...overlayProps.style, display: isOpen ? 'block' : 'none'}}
      >
        {isOpen && (
          <Overlay style={{display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
            <FocusScope contain restoreFocus autoFocus>
              <Flex direction={{xs: 'column', sm: 'row'}}>
                <Stack
                  minWidth="300px"
                  minHeight="0"
                  borderRight={{sm: 'primary'}}
                  borderBottom={{xs: 'primary', sm: undefined}}
                  onKeyDown={onKeyDown}
                >
                  <Flex align="center" justify="between" padding="sm lg">
                    <Text size="sm" bold wrap="nowrap">
                      {t('Metrics')}
                    </Text>
                    {isFetching && <LoadingIndicator size={12} style={{margin: 0}} />}
                  </Flex>
                  <Container padding="0 xs">
                    <InputGroup>
                      <InputGroup.LeadingItems disablePointerEvents>
                        <Flex
                          paddingLeft="2xs"
                          align="center"
                          justify="center"
                          style={{transform: 'translateY(1px) translateX(1px)'}}
                        >
                          <IconSearch size="xs" variant="muted" />
                        </Flex>
                      </InputGroup.LeadingItems>
                      <InputGroup.Input
                        placeholder={t('Search metrics\u2026')}
                        value={searchInputValue}
                        onChange={onSearchChange}
                        size="xs"
                      />
                    </InputGroup>
                  </Container>
                  <Container
                    ref={scrollElementRef}
                    role="listbox"
                    overflowY="auto"
                    flex="1"
                    minHeight="0"
                    maxHeight="400px"
                    padding="xs 0"
                  >
                    {longestOption && (
                      <div
                        aria-hidden
                        style={{visibility: 'hidden', height: 0, overflow: 'hidden'}}
                      >
                        <MenuListItem
                          as="div"
                          size="md"
                          label={longestOption.label}
                          leadingItems={
                            <Fragment>
                              <LeadWrap>
                                <IconCheckmark size="sm" />
                              </LeadWrap>
                            </Fragment>
                          }
                          trailingItems={
                            <Flex gap="xs" align="center" flexShrink={0}>
                              <MetricTypeBadge metricType={longestOption.metricType} />
                              {hasMetricUnitsUI &&
                                longestOption.metricUnit &&
                                longestOption.metricUnit !== '-' &&
                                longestOption.metricUnit !== NONE_UNIT && (
                                  <Tag variant="promotion">
                                    {longestOption.metricUnit}
                                  </Tag>
                                )}
                            </Flex>
                          }
                        />
                      </div>
                    )}
                    {displayedOptions.length === 0 ? (
                      <Flex align="center" justify="center" padding="xl">
                        <Text variant="muted" size="sm">
                          {t('No metrics found')}
                        </Text>
                      </Flex>
                    ) : (
                      <Container
                        width="100%"
                        position="relative"
                        style={{height: virtualizer.getTotalSize()}}
                      >
                        <Container
                          width="100%"
                          position="absolute"
                          top={0}
                          left={0}
                          style={{
                            transform: `translateY(${itemsToRender[0]?.start ?? 0}px)`,
                          }}
                        >
                          {itemsToRender.map(virtualRow => {
                            const option = displayedOptions[virtualRow.index];
                            if (!option) {
                              return null;
                            }
                            const isSelected = option.value === traceMetricSelectValue;
                            const isFocused = virtualRow.index === focusedIndex;
                            return (
                              <div
                                key={option.value}
                                ref={virtualizer.measureElement}
                                data-index={virtualRow.index}
                                role="option"
                                aria-label={option.label}
                                aria-selected={isSelected}
                                onClick={() => handleSelect(option)}
                                onMouseEnter={() => setFocusedIndex(virtualRow.index)}
                              >
                                <MenuListItem
                                  as="div"
                                  size="md"
                                  label={option.label}
                                  isFocused={isFocused}
                                  isSelected={isSelected}
                                  priority={isSelected ? 'primary' : 'default'}
                                  leadingItems={
                                    <LeadWrap aria-hidden="true">
                                      {isSelected && <IconCheckmark size="sm" />}
                                    </LeadWrap>
                                  }
                                  trailingItems={
                                    <Flex gap="xs" align="center" flexShrink={0}>
                                      <MetricTypeBadge metricType={option.metricType} />
                                      {hasMetricUnitsUI &&
                                        option.metricUnit &&
                                        option.metricUnit !== '-' &&
                                        option.metricUnit !== NONE_UNIT && (
                                          <Tag variant="promotion">
                                            {option.metricUnit}
                                          </Tag>
                                        )}
                                    </Flex>
                                  }
                                />
                              </div>
                            );
                          })}
                        </Container>
                      </Container>
                    )}
                  </Container>
                </Stack>
                {canUseMetricsSidePanelUI(organization) ? (
                  <Container width={{sm: '280px'}} padding="lg" minHeight={{sm: '200px'}}>
                    <MetricDetailPanel
                      metric={highlightedOption ?? optionFromTraceMetric}
                      hasMetricUnitsUI={hasMetricUnitsUI}
                    />
                  </Container>
                ) : null}
              </Flex>
            </FocusScope>
          </Overlay>
        )}
      </PositionWrapper>
    </Container>
  );
}

function MetricDetailPanel({
  metric,
  hasMetricUnitsUI,
}: {
  hasMetricUnitsUI: boolean;
  metric: MetricSelectOption | null;
}) {
  if (!metric) {
    return (
      <Flex align="center" justify="center" flex="1">
        <Text variant="muted">{t('Select a metric to see details')}</Text>
      </Flex>
    );
  }

  return (
    <Stack gap="md">
      <Text bold>{metric.metricName}</Text>
      <Flex gap="xs" align="center">
        <Text variant="muted" size="sm">
          {t('Type:')}
        </Text>
        <MetricTypeBadge metricType={metric.metricType} />
      </Flex>
      {hasMetricUnitsUI &&
        metric.metricUnit &&
        metric.metricUnit !== '-' &&
        metric.metricUnit !== NONE_UNIT && (
          <Flex gap="xs" align="center">
            <Text variant="muted" size="sm">
              {t('Unit:')}
            </Text>
            <Tag variant="promotion">{metric.metricUnit}</Tag>
          </Flex>
        )}
    </Stack>
  );
}

function makeMetricSelectValue(metric: TraceMetric): string {
  return `${metric.name}||${metric.type}||${metric.unit ?? '-'}`;
}
