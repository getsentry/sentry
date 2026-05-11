import {Fragment, useCallback, useEffect, useId, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';
import {useComboBox} from '@react-aria/combobox';
import {FocusScope} from '@react-aria/focus';
import {useKeyboard} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import {Item} from '@react-stately/collections';
import {useComboBoxState} from '@react-stately/combobox';
import {useVirtualizer} from '@tanstack/react-virtual';

import {Tag} from '@sentry/scraps/badge';
import {LeadWrap, ListWrap} from '@sentry/scraps/compactSelect';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {MenuListItem} from '@sentry/scraps/menuListItem';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconCheckmark, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useOverlay} from 'sentry/utils/useOverlay';
import {usePrevious} from 'sentry/utils/usePrevious';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import {NONE_UNIT} from 'sentry/views/explore/metrics/constants';
import {useHasMetricUnitsUI} from 'sentry/views/explore/metrics/hooks/useHasMetricUnitsUI';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricTypeBadge} from 'sentry/views/explore/metrics/metricToolbar/metricOptionLabel';
import {MetricDetailPanel} from 'sentry/views/explore/metrics/metricToolbar/metricSelector/metricDetailPanel';
import {MetricListBoxOption} from 'sentry/views/explore/metrics/metricToolbar/metricSelector/metricListBoxOption';
import type {MetricSelectorOption} from 'sentry/views/explore/metrics/metricToolbar/metricSelector/types';
import {
  TraceMetricKnownFieldKey,
  type TraceMetricTypeValue,
} from 'sentry/views/explore/metrics/types';
import {
  hasDisplayMetricUnit,
  makeMetricSelectValue,
} from 'sentry/views/explore/metrics/utils';

const METRIC_SELECTOR_OPTION_HEIGHT = 42;
const METRIC_SELECTOR_DROPDOWN_MAX_HEIGHT = 400;
const METRIC_SELECTOR_DROPDOWN_MIN_HEIGHT = 0;

function maybePortal(element: React.ReactElement, portal?: boolean) {
  return portal ? createPortal(element, document.body) : element;
}

function nextFrameCallback(cb: () => void) {
  if ('requestAnimationFrame' in window) {
    window.requestAnimationFrame(() => cb());
  } else {
    setTimeout(() => {
      cb();
    }, 1);
  }
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

export function MetricSelector({
  traceMetric,
  onChange,
  projectIds,
  environments,
  usePortal,
}: {
  onChange: (traceMetric: TraceMetric) => void;
  traceMetric: TraceMetric;
  environments?: string[];
  projectIds?: number[];
  usePortal?: boolean;
}) {
  const triggerId = useId();

  const hasMetricUnitsUI = useHasMetricUnitsUI();

  const searchRef = useRef<HTMLInputElement>(null);
  const listElementRef = useRef<HTMLUListElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const sidePanelRef = useRef<HTMLDivElement>(null);

  const [searchInputValue, setSearchInputValue] = useState('');
  const [sidePanelAnchorOffset, setSidePanelAnchorOffset] = useState<number | null>(null);
  const debouncedSearch = useDebouncedValue(searchInputValue, DEFAULT_DEBOUNCE_DURATION);
  const {data: metricOptionsData, isFetching} = useMetricOptions({
    search: debouncedSearch,
    projectIds,
    environments,
  });

  const traceMetricSelectValue = makeMetricSelectValue(
    hasMetricUnitsUI ? traceMetric : {name: traceMetric.name, type: traceMetric.type}
  );

  // Build an option object from the currently selected trace metric so it
  // can be shown in the list even if the API response hasn't loaded yet or
  // doesn't include it (e.g. it was filtered out by search).
  const optionFromTraceMetric: MetricSelectorOption = useMemo(
    () => ({
      label: traceMetric.name,
      value: traceMetricSelectValue,
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
      traceMetricSelectValue,
      traceMetric.name,
      traceMetric.type,
      traceMetric.unit,
      hasMetricUnitsUI,
    ]
  );

  // Always show the selected metric at the top of the list so it's easy to
  // find when the dropdown is reopened. Filter it out of the API results to
  // avoid duplication.
  const metricOptions = useMemo((): MetricSelectorOption[] => {
    const selectedMetricValue = traceMetric.name ? traceMetricSelectValue : null;

    const apiOptions =
      metricOptionsData?.data?.map(option => ({
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
        count: option[`count(${TraceMetricKnownFieldKey.METRIC_NAME})`] as number,
        lastSeen:
          option[`max(${TraceMetricKnownFieldKey.TIMESTAMP_PRECISE})`] === undefined
            ? undefined
            : Number(option[`max(${TraceMetricKnownFieldKey.TIMESTAMP_PRECISE})`]) /
              1_000_000,
        trailingItems: () => (
          <MetricOptionTrailingItems
            hasMetricUnitsUI={hasMetricUnitsUI}
            metricType={option[TraceMetricKnownFieldKey.METRIC_TYPE]}
            metricUnit={option[TraceMetricKnownFieldKey.METRIC_UNIT] ?? NONE_UNIT}
          />
        ),
      })) ?? [];

    // Prefer the API version of the selected metric (it has count/lastSeen),
    // falling back to the bare optionFromTraceMetric when the API hasn't
    // returned it (e.g. filtered by search or still loading).
    const selectedOption = selectedMetricValue
      ? (apiOptions.find(o => o.value === selectedMetricValue) ?? optionFromTraceMetric)
      : null;

    return [
      ...(selectedOption ? [selectedOption] : []),
      ...apiOptions.filter(o => o.value !== selectedMetricValue),
    ];
  }, [
    metricOptionsData,
    optionFromTraceMetric,
    traceMetric.name,
    traceMetricSelectValue,
    hasMetricUnitsUI,
  ]);

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

  // Show the previous options while a new search is loading so the list
  // doesn't flash empty during debounced re-fetches.
  const previousOptions = usePrevious(metricOptions);
  const displayedOptions = useMemo(
    () => (isFetching ? previousOptions : metricOptions),
    [isFetching, previousOptions, metricOptions]
  );

  // Find the option with the longest label to render as a hidden element.
  // This reserves enough width for the overlay so it doesn't resize as
  // the user scrolls through the virtualized list.
  const longestOption = useMemo(() => {
    return displayedOptions.reduce<MetricSelectorOption | null>((longest, option) => {
      if (typeof option.label !== 'string' || option.label.length === 0) {
        return longest;
      }

      if (typeof longest?.label !== 'string') {
        return option;
      }

      return option.label.length > longest?.label.length ? option : longest;
    }, null);
  }, [displayedOptions]);

  const displayedOptionsMap = useMemo(
    () => new Map(displayedOptions.map(option => [option.value, option])),
    [displayedOptions]
  );

  function handleOverlayOpenChange(open: boolean) {
    if (open) {
      nextFrameCallback(() => {
        updateOverlay?.();
        if (scrollElementRef.current) {
          scrollElementRef.current.scrollTop = 0;
        }
        searchRef.current?.focus({preventScroll: true});
      });
      return;
    }

    setSearchInputValue('');
    comboBoxState.selectionManager.setFocused(false);
    comboBoxState.selectionManager.setFocusedKey(null);
    nextFrameCallback(() => {
      if (
        document.activeElement === document.body ||
        triggerRef.current?.contains(document.activeElement) ||
        popoverRef.current?.contains(document.activeElement)
      ) {
        nextFrameCallback(() => {
          triggerRef.current?.focus();
        });
      }
    });
  }

  const comboBoxState = useComboBoxState<MetricSelectorOption>({
    children: (item: MetricSelectorOption) => <Item key={item.value}>{item.label}</Item>,
    items: displayedOptions,
    allowsEmptyCollection: true,
    shouldCloseOnBlur: false,
    menuTrigger: 'manual',
    defaultFilter: () => true,
    inputValue: searchInputValue,
    onInputChange: setSearchInputValue,
    selectedKey: traceMetric.name ? traceMetricSelectValue : null,
    onSelectionChange: key => {
      if (!key) {
        return;
      }
      const selectedOption = displayedOptionsMap.get(String(key));
      if (selectedOption) {
        onChange({
          name: selectedOption.metricName,
          type: selectedOption.metricType,
          unit: hasMetricUnitsUI ? selectedOption.metricUnit : undefined,
        });
        // Close via toggle() instead of close() because the combobox
        // overrides close with commitValue which re-fires onSelectionChange
        // with the stale previous key, reverting the selection.
        comboBoxState.toggle();
      }
    },
    onOpenChange: handleOverlayOpenChange,
  });

  const {
    isOpen,
    state: overlayState,
    triggerProps,
    overlayProps,
    arrowProps: overlayArrowProps,
    triggerRef,
    update: updateOverlay,
  } = useOverlay({
    type: 'listbox',
    position: 'bottom-start',
    offset: 6,
    isOpen: comboBoxState.isOpen,
    isDismissable: true,
    isKeyboardDismissDisabled: true,
    shouldApplyMinWidth: true,
    disableTrigger: isFetching && !traceMetric.name,
    onOpenChange: open => {
      if (open === comboBoxState.isOpen) {
        return;
      }

      if (open) {
        comboBoxState.open();
      } else {
        // close() commits the current selected key before dismissing, which
        // spuriously re-fires onSelectionChange during outside dismissals.
        comboBoxState.toggle();
      }
    },
  });

  const {inputProps: comboBoxInputProps, listBoxProps} =
    useComboBox<MetricSelectorOption>(
      {
        'aria-labelledby': triggerId,
        listBoxRef: listElementRef,
        inputRef: searchRef,
        popoverRef,
        shouldFocusWrap: true,
      },
      comboBoxState
    );

  const collectionItems = useMemo(
    () => [...comboBoxState.collection],
    [comboBoxState.collection]
  );
  const focusedKey = comboBoxState.selectionManager.focusedKey;

  const virtualizer = useVirtualizer({
    count: collectionItems.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => METRIC_SELECTOR_OPTION_HEIGHT,
    overscan: 20,
  });

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

  const mergedTriggerProps = mergeProps(triggerProps, triggerKeyboardProps, {
    id: triggerId,
  });

  const isOverlayAboveTrigger = overlayArrowProps.placement?.startsWith('top') ?? false;
  const activeOptionIndex = focusedKey
    ? collectionItems.findIndex(item => item.key === focusedKey)
    : -1;

  const updateSidePanelAnchorOffset = useCallback(
    (activeOptionElement?: HTMLElement | null) => {
      if (!isOpen || (!activeOptionElement && activeOptionIndex < 0)) {
        setSidePanelAnchorOffset(null);
        return;
      }

      const optionElement =
        activeOptionElement ??
        listElementRef.current?.querySelector<HTMLElement>(
          `[data-index="${activeOptionIndex}"]`
        );
      const popoverElement = popoverRef.current;

      if (!optionElement || !popoverElement) {
        setSidePanelAnchorOffset(null);
        return;
      }

      const optionRect = optionElement.getBoundingClientRect();
      const popoverRect = popoverElement.getBoundingClientRect();
      const sidePanelRect = sidePanelRef.current?.getBoundingClientRect();
      const optionCenter = optionRect.top + optionRect.height / 2;
      const sidePanelHeight = sidePanelRect?.height ?? 0;
      const offset = isOverlayAboveTrigger
        ? popoverRect.bottom - optionCenter - sidePanelHeight / 2
        : optionCenter - popoverRect.top - sidePanelHeight / 2;
      const maxOffset = Math.max(0, popoverRect.height - sidePanelHeight);

      setSidePanelAnchorOffset(Math.min(Math.max(0, offset), maxOffset));
    },
    [activeOptionIndex, isOpen, isOverlayAboveTrigger]
  );

  const setSidePanelRef = useCallback(
    (element: HTMLDivElement | null) => {
      sidePanelRef.current = element;
      if (element) {
        updateSidePanelAnchorOffset();
      }
    },
    [updateSidePanelAnchorOffset]
  );

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
          size: METRIC_SELECTOR_OPTION_HEIGHT,
          lane: 0,
        }));

  const sidePanelAnchorPosition =
    sidePanelAnchorOffset === null ? '0px' : `${sidePanelAnchorOffset}px`;
  const hasSelectedMetric = Boolean(traceMetric.name);

  return (
    <Container width="100%" position="relative">
      <OverlayTrigger.Button
        {...mergedTriggerProps}
        style={{width: '100%', fontWeight: 'bold', textAlign: 'left'}}
        disabled={isFetching && !traceMetric.name}
        tooltipProps={{title: traceMetric.name || t('None')}}
      >
        <Text ellipsis>{traceMetric.name || t('None')}</Text>
      </OverlayTrigger.Button>
      {maybePortal(
        <PositionWrapper
          zIndex={1017}
          {...overlayProps}
          style={{...overlayProps.style, display: isOpen ? 'block' : 'none'}}
        >
          {isOpen ? (
            <MetricSelectorOverlay
              ref={popoverRef}
              style={{display: 'flex', flexDirection: 'column'}}
            >
              <FocusScope contain>
                <Flex
                  minHeight="0"
                  direction={{
                    xs: isOverlayAboveTrigger ? 'column-reverse' : 'column',
                    md: 'row',
                  }}
                >
                  <Stack
                    minWidth="400px"
                    minHeight={`${METRIC_SELECTOR_DROPDOWN_MIN_HEIGHT}px`}
                    maxHeight={`${METRIC_SELECTOR_DROPDOWN_MAX_HEIGHT}px`}
                    borderBottom={
                      isOverlayAboveTrigger ? undefined : {xs: 'primary', md: undefined}
                    }
                    borderTop={
                      isOverlayAboveTrigger ? {xs: 'primary', md: undefined} : undefined
                    }
                  >
                    <Flex align="center" justify="between" padding="sm lg">
                      <Text size="sm" bold wrap="nowrap">
                        {t('Application Metrics')}
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
                            style={{
                              transform: 'translateY(1px) translateX(1px)',
                            }}
                          >
                            <IconSearch size="xs" variant="muted" />
                          </Flex>
                        </InputGroup.LeadingItems>
                        <InputGroup.Input
                          {...comboBoxInputProps}
                          placeholder={t('Search application metrics\u2026')}
                          size="xs"
                          ref={searchRef}
                        />
                      </InputGroup>
                    </Container>
                    <Container
                      ref={scrollElementRef}
                      overflowY="auto"
                      flex="1"
                      minHeight="0"
                      padding="xs 0"
                      onScroll={() => updateSidePanelAnchorOffset()}
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
                            {t('No application metrics found')}
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
                              id={listBoxProps.id}
                              aria-label={listBoxProps['aria-label']}
                              aria-labelledby={listBoxProps['aria-labelledby']}
                              role="listbox"
                              style={{padding: 0}}
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
                                    listState={comboBoxState}
                                    size="md"
                                    dataIndex={virtualRow.index}
                                    measureRef={virtualizer.measureElement}
                                    updateSidePanelAnchorOffset={
                                      updateSidePanelAnchorOffset
                                    }
                                  />
                                );
                              })}
                            </ListWrap>
                          </Container>
                        </Container>
                      )}
                    </Container>
                  </Stack>
                  {hasSelectedMetric ? (
                    <SidePanel
                      ref={setSidePanelRef}
                      top={
                        isOverlayAboveTrigger
                          ? undefined
                          : {xs: 'auto', md: sidePanelAnchorPosition}
                      }
                      bottom={
                        isOverlayAboveTrigger
                          ? {xs: 'auto', md: sidePanelAnchorPosition}
                          : undefined
                      }
                      width={{xs: '100%', md: '280px'}}
                      padding="lg"
                      minHeight="0"
                    >
                      <MetricDetailPanel
                        metric={highlightedOption ?? optionFromTraceMetric}
                        hasMetricUnitsUI={hasMetricUnitsUI}
                      />
                    </SidePanel>
                  ) : null}
                </Flex>
              </FocusScope>
            </MetricSelectorOverlay>
          ) : null}
        </PositionWrapper>,
        usePortal
      )}
    </Container>
  );
}

const MetricSelectorOverlay = styled(Overlay)`
  @media (min-width: ${p => p.theme.breakpoints.md}) {
    overflow: visible;
  }
`;

const SidePanel = styled(Container)`
  @media (min-width: ${p => p.theme.breakpoints.md}) {
    position: absolute;
    left: 100%;
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    background: ${p => p.theme.tokens.background.primary};
    border: 1px solid ${p => p.theme.tokens.border.primary};
    border-radius: ${p => p.theme.radius.md};
  }
`;
