import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {useVirtualizer} from '@tanstack/react-virtual';

import {Tag} from '@sentry/scraps/badge';
import {LeadWrap} from '@sentry/scraps/compactSelect';
import {InputGroup} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';
import {MenuListItem} from '@sentry/scraps/menuListItem';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconCheckmark, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useOverlay} from 'sentry/utils/useOverlay';
import {usePrevious} from 'sentry/utils/usePrevious';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import {useHasMetricUnitsUI} from 'sentry/views/explore/metrics/hooks/useHasMetricUnitsUI';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
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
  const [searchInputValue, setSearchInputValue] = useState('');
  const debouncedSearch = useDebouncedValue(searchInputValue, DEFAULT_DEBOUNCE_DURATION);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const {data: metricOptionsData, isFetching} = useMetricOptions({
    search: debouncedSearch,
  });
  const hasMetricUnitsUI = useHasMetricUnitsUI();
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const {
    isOpen,
    state: overlayState,
    triggerProps,
    overlayProps,
  } = useOverlay({
    type: 'listbox',
    position: 'bottom-start',
    offset: 4,
    isDismissable: true,
    shouldApplyMinWidth: true,
    onOpenChange: open => {
      if (open) {
        // Focus the search input when the overlay opens
        requestAnimationFrame(() => {
          searchRef.current?.focus();
        });
      } else {
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
    overscan: 5,
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
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => {
            const next = Math.min(prev + 1, displayedOptions.length - 1);
            virtualizer.scrollToIndex(next);
            return next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => {
            const next = Math.max(prev - 1, 0);
            virtualizer.scrollToIndex(next);
            return next;
          });
          break;
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

  return (
    <div style={{width: '100%', position: 'relative'}}>
      <TriggerButton {...triggerProps}>
        <TriggerLabel>{traceMetric.name || t('Select a metric')}</TriggerLabel>
      </TriggerButton>
      <StyledPositionWrapper zIndex={1001} visible={isOpen} {...overlayProps}>
        {isOpen && (
          <StyledOverlay>
            <FocusScope contain restoreFocus>
              <PanelLayout>
                <OptionsPanel onKeyDown={onKeyDown}>
                  <MenuHeader>
                    <MenuTitle>{t('Metrics')}</MenuTitle>
                    {isFetching && <StyledLoadingIndicator size={12} />}
                  </MenuHeader>
                  <SearchWrap>
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
                      <SearchInput
                        ref={searchRef}
                        placeholder={t('Search metrics\u2026')}
                        value={searchInputValue}
                        onChange={onSearchChange}
                        size="xs"
                      />
                    </InputGroup>
                  </SearchWrap>
                  <OptionsList ref={scrollElementRef} role="listbox">
                    {longestOption && (
                      <WidthSizer aria-hidden>
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
                      </WidthSizer>
                    )}
                    {displayedOptions.length === 0 ? (
                      <EmptyMessage>
                        <Text variant="muted" size="sm">
                          {t('No metrics found')}
                        </Text>
                      </EmptyMessage>
                    ) : (
                      <div
                        style={{
                          height: virtualizer.getTotalSize(),
                          width: '100%',
                          position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
                          }}
                        >
                          {virtualItems.map(virtualRow => {
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
                                    <Fragment>
                                      <LeadWrap aria-hidden="true">
                                        {isSelected && <IconCheckmark size="sm" />}
                                      </LeadWrap>
                                    </Fragment>
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
                        </div>
                      </div>
                    )}
                  </OptionsList>
                </OptionsPanel>
                <DetailPanel>
                  <MetricDetailPanel
                    metric={highlightedOption ?? optionFromTraceMetric}
                    hasMetricUnitsUI={hasMetricUnitsUI}
                  />
                </DetailPanel>
              </PanelLayout>
            </FocusScope>
          </StyledOverlay>
        )}
      </StyledPositionWrapper>
    </div>
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
    <Flex direction="column" gap="md">
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
    </Flex>
  );
}

function makeMetricSelectValue(metric: TraceMetric): string {
  return `${metric.name}||${metric.type}||${metric.unit ?? '-'}`;
}

const StyledPositionWrapper = styled(PositionWrapper, {
  shouldForwardProp: prop => isPropValid(prop),
})<{visible?: boolean; zIndex?: number}>`
  display: ${p => (p.visible ? 'block' : 'none')};
  z-index: ${p => p?.zIndex};
`;

const TriggerButton = styled(OverlayTrigger.Button)`
  width: 100%;
  font-weight: bold;
`;

const TriggerLabel = styled('span')`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
`;

const StyledOverlay = styled(Overlay)`
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const NARROW_BREAKPOINT = '700px';

const PanelLayout = styled('div')`
  display: flex;
  flex-direction: row;

  @media (max-width: ${NARROW_BREAKPOINT}) {
    flex-direction: column;
  }
`;

const OptionsPanel = styled('div')`
  display: flex;
  flex-direction: column;
  min-width: 300px;
  min-height: 0;
  border-right: 1px solid ${p => p.theme.tokens.border.primary};

  @media (max-width: ${NARROW_BREAKPOINT}) {
    border-right: none;
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const MenuHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.lg};
`;

const MenuTitle = styled('span')`
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  white-space: nowrap;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  display: flex;
  align-items: center;
  && {
    margin: 0;
  }
`;

const SearchWrap = styled('div')`
  padding: 0 ${p => p.theme.space.xs};
`;

const SearchInput = styled(InputGroup.Input)`
  appearance: none;
  width: calc(100% - ${p => p.theme.space.xs} * 2);
  margin: ${p => p.theme.space.xs};
`;

const OptionsList = styled('div')`
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  max-height: 400px;
  padding: ${p => p.theme.space.xs} 0;
`;

const WidthSizer = styled('div')`
  visibility: hidden;
  height: 0;
  overflow: hidden;
`;

const EmptyMessage = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space.xl};
`;

const DetailPanel = styled('div')`
  width: 280px;
  padding: ${p => p.theme.space.lg};
  min-height: 200px;

  @media (max-width: ${NARROW_BREAKPOINT}) {
    width: auto;
    min-height: auto;
  }
`;
