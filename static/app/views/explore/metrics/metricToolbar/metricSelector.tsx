import {Fragment, useCallback, useEffect, useId, useMemo, useRef, useState} from 'react';
import {FocusScope} from '@react-aria/focus';
import {useKeyboard} from '@react-aria/interactions';
import {useListBox, useOption} from '@react-aria/listbox';
import {mergeProps, mergeRefs} from '@react-aria/utils';
import {Item} from '@react-stately/collections';
import {useListState, type ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';
import {useVirtualizer} from '@tanstack/react-virtual';

import {Tag} from '@sentry/scraps/badge';
import {LeadWrap, ListWrap} from '@sentry/scraps/compactSelect';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {MenuListItem, type MenuListItemProps} from '@sentry/scraps/menuListItem';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
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

function nextFrameCallback(cb: () => void) {
  if ('requestAnimationFrame' in window) {
    window.requestAnimationFrame(() => cb());
  } else {
    setTimeout(() => {
      cb();
    }, 1);
  }
}

function hasDisplayMetricUnit(
  hasMetricUnitsUI: boolean,
  metricUnit?: string
): metricUnit is string {
  return (
    hasMetricUnitsUI && !!metricUnit && metricUnit !== '-' && metricUnit !== NONE_UNIT
  );
}

function MetricOptionTrailingItems({
  metricType,
  metricUnit,
  hasMetricUnitsUI,
}: {
  hasMetricUnitsUI: boolean;
  metricType: TraceMetricTypeValue;
  metricUnit?: string;
}) {
  return (
    <Fragment>
      <MetricTypeBadge metricType={metricType} />
      {hasDisplayMetricUnit(hasMetricUnitsUI, metricUnit) ? (
        <Tag variant="promotion">{metricUnit}</Tag>
      ) : null}
    </Fragment>
  );
}

interface MetricSelectOption {
  label: string;
  metricName: string;
  metricType: TraceMetricTypeValue;
  value: string;
  metricUnit?: string;
  trailingItems?: MenuListItemProps['trailingItems'];
}

export function MetricSelector({
  traceMetric,
  onChange,
}: {
  onChange: (traceMetric: TraceMetric) => void;
  traceMetric: TraceMetric;
}) {
  const triggerId = useId();

  const organization = useOrganization();
  const hasMetricUnitsUI = useHasMetricUnitsUI();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listElementRef = useRef<HTMLUListElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const [searchInputValue, setSearchInputValue] = useState('');
  const debouncedSearch = useDebouncedValue(searchInputValue, DEFAULT_DEBOUNCE_DURATION);
  const {data: metricOptionsData, isFetching} = useMetricOptions({
    search: debouncedSearch,
  });

  const {
    isOpen,
    state: overlayState,
    triggerProps,
    overlayProps,
    triggerRef,
    overlayRef,
    update: updateOverlay,
  } = useOverlay({
    type: 'listbox',
    position: 'bottom-start',
    offset: 6,
    isDismissable: true,
    shouldApplyMinWidth: true,
    disableTrigger: isFetching && !traceMetric.name,
    onOpenChange: open => {
      nextFrameCallback(() => {
        if (open) {
          updateOverlay?.();
          if (searchRef.current) {
            searchRef.current.focus();
            return;
          }

          const firstSelectedOption = overlayRef.current?.querySelector<HTMLLIElement>(
            'li[role="option"][aria-selected="true"]'
          );
          if (firstSelectedOption) {
            firstSelectedOption.focus();
            return;
          }

          overlayRef.current?.querySelector<HTMLLIElement>('li[role="option"]')?.focus();
          return;
        }

        setSearchInputValue('');
        if (
          document.activeElement === document.body ||
          wrapperRef.current?.contains(document.activeElement)
        ) {
          nextFrameCallback(() => {
            const triggerElement =
              triggerRef.current ??
              wrapperRef.current?.querySelector<HTMLButtonElement>('button');
            triggerElement?.focus();
          });
        }
      });
    },
  });

  const metricSelectValue = makeMetricSelectValue(
    hasMetricUnitsUI ? traceMetric : {name: traceMetric.name, type: traceMetric.type}
  );

  // Build an option object from the currently selected trace metric so it
  // can be shown in the list even if the API response hasn't loaded yet or
  // doesn't include it (e.g. it was filtered out by search).
  const optionFromTraceMetric: MetricSelectOption = useMemo(
    () => ({
      label: traceMetric.name,
      value: metricSelectValue,
      metricType: traceMetric.type as TraceMetricTypeValue,
      metricUnit: hasMetricUnitsUI ? (traceMetric.unit ?? '-') : undefined,
      metricName: traceMetric.name,
      trailingItems: () => (
        <MetricOptionTrailingItems
          metricType={traceMetric.type as TraceMetricTypeValue}
          metricUnit={traceMetric.unit ?? '-'}
          hasMetricUnitsUI={hasMetricUnitsUI}
        />
      ),
    }),
    [
      metricSelectValue,
      traceMetric.name,
      traceMetric.type,
      traceMetric.unit,
      hasMetricUnitsUI,
    ]
  );

  // Merge API results with the currently selected metric. If the selected
  // metric isn't present in the API response (e.g. filtered by search),
  // prepend it so the user always sees their current selection.
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
          <MetricOptionTrailingItems
            hasMetricUnitsUI={hasMetricUnitsUI}
            metricType={option[TraceMetricKnownFieldKey.METRIC_TYPE]}
            metricUnit={option[TraceMetricKnownFieldKey.METRIC_UNIT] ?? NONE_UNIT}
          />
        ),
      })) ?? []),
    ];
  }, [metricOptionsData, optionFromTraceMetric, traceMetric, hasMetricUnitsUI]);

  // Auto-select the first metric when no metric is currently selected.
  // This handles the initial load case where the URL has no metric param.
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

  // Show the previous options while a new search is loading so the list
  // doesn't flash empty during debounced re-fetches.
  const previousOptions = usePrevious(metricOptions ?? []);
  const displayedOptions = useMemo(
    () => (isFetching ? previousOptions : (metricOptions ?? [])),
    [isFetching, previousOptions, metricOptions]
  );

  // Find the option with the longest label to render as a hidden element.
  // This reserves enough width for the overlay so it doesn't resize as
  // the user scrolls through the virtualized list.
  const longestOption = useMemo(
    () =>
      displayedOptions.reduce<MetricSelectOption | null>(
        (longest, option) =>
          !longest || option.label.length > longest.label.length ? option : longest,
        null
      ),
    [displayedOptions]
  );

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

  const displayedOptionsMap = useMemo(
    () => new Map(displayedOptions.map(option => [option.value, option])),
    [displayedOptions]
  );

  const listState = useListState<MetricSelectOption>({
    items: displayedOptions,
    selectionMode: 'single',
    selectedKeys: traceMetric.name ? [traceMetricSelectValue] : [],
    allowDuplicateSelectionEvents: true,
    onSelectionChange: selection => {
      if (selection === 'all') {
        return;
      }
      const selectedKey = Array.from(selection)[0];
      if (!selectedKey) {
        return;
      }
      const selectedOption = displayedOptionsMap.get(String(selectedKey));
      if (selectedOption) {
        handleSelect(selectedOption);
      }
    },
    children: (item: MetricSelectOption) => <Item key={item.value}>{item.label}</Item>,
  });

  const {listBoxProps} = useListBox(
    {
      shouldFocusWrap: true,
      shouldFocusOnHover: true,
      shouldSelectOnPressUp: true,
      'aria-labelledby': triggerId,
    },
    listState,
    listElementRef
  );

  const collectionItems = useMemo(
    () => [...listState.collection],
    [listState.collection]
  );
  const focusedKey = listState.selectionManager.focusedKey;

  const virtualizer = useVirtualizer({
    count: collectionItems.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => 42,
    overscan: 20,
  });

  const focusedIndex = useMemo(
    () => collectionItems.findIndex(item => item.key === focusedKey),
    [collectionItems, focusedKey]
  );

  useEffect(() => {
    if (focusedIndex >= 0 && isOpen) {
      virtualizer.scrollToIndex(focusedIndex, {align: 'auto'});
    }
  }, [focusedIndex, isOpen, virtualizer]);

  const highlightedOption = focusedKey
    ? (displayedOptionsMap.get(String(focusedKey)) ?? null)
    : null;

  const {keyboardProps: triggerKeyboardProps} = useKeyboard({
    onKeyDown: e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        overlayState.open();
      } else {
        e.continuePropagation();
      }
    },
  });

  // The search input sits outside the listbox, so useListBox's shouldFocusWrap
  // never sees these keystrokes. We manually bridge focus from the search field
  // into the list here; once focus is inside the list, shouldFocusWrap takes over.
  const {keyboardProps: searchKeyboardProps} = useKeyboard({
    onKeyDown: e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const firstKey = listState.collection.getFirstKey();
        if (firstKey) {
          listState.selectionManager.setFocused(true);
          listState.selectionManager.setFocusedKey(firstKey);
        }
        overlayRef.current?.querySelector<HTMLLIElement>('li[role="option"]')?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const lastKey = listState.collection.getLastKey();
        if (lastKey) {
          listState.selectionManager.setFocused(true);
          listState.selectionManager.setFocusedKey(lastKey);
        }
        const options =
          overlayRef.current?.querySelectorAll<HTMLLIElement>('li[role="option"]');
        options?.[options.length - 1]?.focus();
      }

      if (e.key === 'Enter') {
        e.preventDefault();
      }

      e.continuePropagation();
    },
  });

  const mergedTriggerProps = mergeProps(triggerProps, triggerKeyboardProps, {
    id: triggerId,
  });

  const onSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInputValue(e.target.value);
  }, []);

  const virtualItems = virtualizer.getVirtualItems();

  // Fall back to rendering all items when the virtualizer can't measure
  // the scroll container (e.g. in tests where the DOM has no layout).
  const itemsToRender =
    virtualItems.length > 0 || collectionItems.length === 0
      ? virtualItems
      : collectionItems.map((_, index) => ({
          index,
          key: index,
          start: 0,
          end: 0,
          size: 42,
          lane: 0,
        }));

  return (
    <Container width="100%" position="relative" ref={wrapperRef}>
      <OverlayTrigger.Button
        {...mergedTriggerProps}
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
        {isOpen ? (
          <Overlay style={{display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
            <FocusScope contain>
              <Flex direction={{xs: 'column', sm: 'row'}}>
                <Stack
                  minWidth="400px"
                  minHeight="0"
                  borderRight={{sm: 'primary'}}
                  borderBottom={{xs: 'primary', sm: undefined}}
                >
                  <Flex align="center" justify="between" padding="sm lg">
                    <Text size="sm" bold wrap="nowrap">
                      {t('Metrics')}
                    </Text>
                    {isFetching ? (
                      <LoadingIndicator size={12} style={{margin: 0}} />
                    ) : null}
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
                        ref={searchRef}
                        {...searchKeyboardProps}
                      />
                    </InputGroup>
                  </Container>
                  <Container
                    ref={scrollElementRef}
                    overflowY="auto"
                    flex="1"
                    minHeight="0"
                    maxHeight="400px"
                    padding="xs 0"
                  >
                    {/* Hidden element that reserves width based on the longest option label */}
                    {longestOption ? (
                      <Container
                        aria-hidden
                        visibility="hidden"
                        height={0}
                        overflow="hidden"
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
                          trailingItems={longestOption.trailingItems}
                        />
                      </Container>
                    ) : null}
                    {collectionItems.length === 0 ? (
                      <Flex align="center" justify="center" padding="xl">
                        <Text variant="muted" size="sm">
                          {t('No metrics found')}
                        </Text>
                      </Flex>
                    ) : (
                      <Container
                        width="100%"
                        position="relative"
                        style={{height: `${virtualizer.getTotalSize()}px`}}
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
                          <ListWrap
                            {...listBoxProps}
                            style={{
                              ...listBoxProps.style,
                              padding: 0,
                            }}
                            ref={listElementRef}
                          >
                            {itemsToRender.map(virtualRow => {
                              const item = collectionItems[virtualRow.index];
                              if (item?.type !== 'item') {
                                return null;
                              }

                              return (
                                <MetricListBoxOption
                                  key={item.key}
                                  item={item}
                                  listState={listState}
                                  size="md"
                                  dataIndex={virtualRow.index}
                                  measureRef={virtualizer.measureElement}
                                />
                              );
                            })}
                          </ListWrap>
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
        ) : null}
      </PositionWrapper>
    </Container>
  );
}

interface MetricListBoxOptionProps {
  dataIndex: number;
  item: Node<MetricSelectOption>;
  listState: ListState<MetricSelectOption>;
  size: MenuListItemProps['size'];
  measureRef?: React.Ref<HTMLLIElement>;
}

function MetricListBoxOption({
  item,
  listState,
  size,
  dataIndex,
  measureRef,
}: MetricListBoxOptionProps) {
  const ref = useRef<HTMLLIElement>(null);
  const option = item.value!;
  const {optionProps, isFocused, isSelected, isDisabled, isPressed} = useOption(
    {key: item.key, 'aria-label': option.label},
    listState,
    ref
  );
  const optionPropsMerged = mergeProps(optionProps, {
    onMouseEnter: () => {
      listState.selectionManager.setFocused(true);
      listState.selectionManager.setFocusedKey(item.key);
    },
  });

  return (
    <MenuListItem
      {...optionPropsMerged}
      as="li"
      data-index={dataIndex}
      ref={mergeRefs(ref, measureRef)}
      size={size}
      label={option.label}
      isFocused={listState.selectionManager.isFocused && isFocused}
      isSelected={isSelected}
      isPressed={isPressed}
      disabled={isDisabled}
      priority={isSelected ? 'primary' : 'default'}
      leadingItems={
        <LeadWrap aria-hidden="true">
          {isSelected ? <IconCheckmark size="sm" /> : null}
        </LeadWrap>
      }
      trailingItems={option.trailingItems}
    />
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
      {hasDisplayMetricUnit(hasMetricUnitsUI, metric.metricUnit) ? (
        <Flex gap="xs" align="center">
          <Text variant="muted" size="sm">
            {t('Unit:')}
          </Text>
          <Tag variant="promotion">{metric.metricUnit}</Tag>
        </Flex>
      ) : null}
    </Stack>
  );
}

function makeMetricSelectValue(metric: TraceMetric): string {
  return `${metric.name}||${metric.type}||${metric.unit ?? '-'}`;
}
