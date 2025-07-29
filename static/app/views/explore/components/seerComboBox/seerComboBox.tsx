import {Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {type AriaComboBoxProps} from '@react-aria/combobox';
import {mergeRefs} from '@react-aria/utils';
import {Item} from '@react-stately/collections';
import {useComboBoxState} from '@react-stately/combobox';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {Text} from 'sentry/components/core/text';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useSearchTokenCombobox} from 'sentry/components/searchQueryBuilder/tokens/useSearchTokenCombobox';
import {IconClose, IconMegaphone, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import useOverlay from 'sentry/utils/useOverlay';
import QueryTokens from 'sentry/views/explore/components/queryTokens';
import {
  type SeerSearchItem,
  useApplySeerSearchQuery,
  useSeerSearch,
} from 'sentry/views/explore/components/seerComboBox/hooks';
import {SeerSearchHeader} from 'sentry/views/explore/components/seerComboBox/seerSearchHeader';
import {SeerSearchListBox} from 'sentry/views/explore/components/seerComboBox/seerSearchListBox';
import {SeerSearchPopover} from 'sentry/views/explore/components/seerComboBox/seerSearchPopover';
import {SeerSearchSkeleton} from 'sentry/views/explore/components/seerComboBox/seerSearchSkeleton';
import {useTraceExploreAiQuerySetup} from 'sentry/views/explore/hooks/useTraceExploreAiQuerySetup';
import {formatQueryToNaturalLanguage} from 'sentry/views/explore/utils';

// The menu size can change from things like loading states, long options,
// or custom menus like a date picker. This hook ensures that the overlay
// is updated in response to these changes.
function useUpdateOverlayPositionOnContentChange({
  contentRef,
  updateOverlayPosition,
  isOpen,
}: {
  contentRef: React.RefObject<HTMLDivElement | null>;
  isOpen: boolean;
  updateOverlayPosition: (() => void) | null;
}) {
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Keep a ref to the updateOverlayPosition function so that we can
  // access the latest value in the resize observer callback.
  const updateOverlayPositionRef = useRef(updateOverlayPosition);
  if (updateOverlayPositionRef.current !== updateOverlayPosition) {
    updateOverlayPositionRef.current = updateOverlayPosition;
  }

  useLayoutEffect(() => {
    resizeObserverRef.current = new ResizeObserver(() => {
      if (!updateOverlayPositionRef.current) {
        return;
      }
      updateOverlayPositionRef.current?.();
    });

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!contentRef.current || !resizeObserverRef.current || !isOpen) {
      return () => {};
    }

    resizeObserverRef.current?.observe(contentRef.current);

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [contentRef, isOpen, updateOverlayPosition]);
}

interface SeerComboBoxProps extends Omit<AriaComboBoxProps<unknown>, 'children'> {
  initialQuery: string;
}

interface NoneOfTheseItem {
  key: 'none-of-these';
  label: string;
}

function isNoneOfTheseItem(item: SeerSearchItems): item is NoneOfTheseItem {
  return item.key === 'none-of-these';
}

type SeerSearchItems = SeerSearchItem<string> | NoneOfTheseItem;

export function SeerComboBox({initialQuery, ...props}: SeerComboBoxProps) {
  // console.log('initialQuery', initialQuery);
  // console.log('props', props);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listBoxRef = useRef<HTMLUListElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLInputElement>(null);
  const isInitialRender = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState(() =>
    formatQueryToNaturalLanguage(initialQuery)
  );

  const openForm = useFeedbackForm();
  const {setDisplaySeerResults} = useSearchQueryBuilder();
  const {rawResult, submitQuery, isPending} = useSeerSearch();
  const applySeerSearchQuery = useApplySeerSearchQuery();
  const organization = useOrganization();
  const areAiFeaturesAllowed =
    !organization?.hideAiFeatures && organization.features.includes('gen-ai-features');

  const handleNoneOfTheseClick = () => {
    if (openForm) {
      openForm({
        messagePlaceholder: t('Why were these queries incorrect?'),
        tags: {
          ['feedback.source']: 'trace_explorer_ai_query',
          ['feedback.owner']: 'ml-ai',
          ['feedback.natural_language_query']: searchQuery,
          ['feedback.raw_result']: JSON.stringify(rawResult).replace(/\n/g, ''),
          ['feedback.num_queries_returned']: rawResult?.length ?? 0,
        },
      });
    } else {
      addErrorMessage(t('Unable to open feedback form'));
    }
  };

  const items: SeerSearchItems[] = useMemo(() => {
    if (!rawResult.length) return [];

    const results: SeerSearchItems[] = rawResult.map((query, index) => ({
      ...query,
      key: `${index}-${query.query}`,
    }));

    results.push({
      key: 'none-of-these',
      label: t('None of these'),
    });

    return results;
  }, [rawResult]);

  const state = useComboBoxState({
    ...props,
    items,
    defaultItems: [],
    selectedKey: null,
    allowsCustomValue: true,
    allowsEmptyCollection: true,
    shouldCloseOnBlur: false,
    inputValue: searchQuery,
    onInputChange: setSearchQuery,
    defaultFilter: () => true,
    children: item => {
      if (isNoneOfTheseItem(item)) {
        return (
          <Item key={item.key} textValue={item.label} data-is-none-of-these>
            <Text
              variant="muted"
              onClick={() => {
                trackAnalytics('trace.explorer.ai_query_rejected', {
                  organization,
                  natural_language_query: searchQuery,
                  num_queries_returned: rawResult?.length ?? 0,
                });
                handleNoneOfTheseClick();
              }}
            >
              {item.label}
            </Text>
          </Item>
        );
      }

      return (
        <Item key={item.key}>
          <div
            onClick={() => {
              state.close();
              applySeerSearchQuery(item);
            }}
          >
            <QueryTokens
              groupBys={item.groupBys}
              query={item.query}
              sort={item.sort}
              statsPeriod={item.statsPeriod}
              visualizations={item.visualizations}
            />
          </div>
        </Item>
      );
    },
  });

  useTraceExploreAiQuerySetup({enableAISearch: areAiFeaturesAllowed && state.isOpen});

  const handleExampleClick = useCallback(
    (example: string) => {
      setSearchQuery(example);
      trackAnalytics('trace.explorer.ai_query_example_clicked', {
        organization,
        example_query: example,
      });
      inputRef.current?.focus();
      submitQuery(example);
    },
    [organization, submitQuery]
  );

  const {inputProps, listBoxProps} = useSearchTokenCombobox(
    {
      ...props,
      inputRef,
      buttonRef,
      listBoxRef,
      popoverRef,
      'aria-label': t('Ask Seer with Natural Language'),
      onFocus: () => {
        state.open();
      },
      onBlur: () => {
        state.close();
      },
      onKeyDown: e => {
        switch (e.key) {
          case 'Escape':
            if (!state.isOpen) {
              setDisplaySeerResults(false);
            }

            state.close();
            return;
          case 'Enter':
            if (state.isOpen && state.selectionManager.focusedKey === 'none-of-these') {
              handleNoneOfTheseClick();
              state.open();
              return;
            }

            if (state.isOpen && state.selectionManager.focusedKey) {
              const item = items.find(i => i.key === state.selectionManager.focusedKey);
              if (!item || isNoneOfTheseItem(item)) {
                addErrorMessage(t('Failed to find AI query to apply'));
                return;
              }
              state.close();
              applySeerSearchQuery(item);
              return;
            }

            if (
              state.isOpen &&
              searchQuery.trim() !== null &&
              searchQuery.trim() !== ''
            ) {
              trackAnalytics('trace.explorer.ai_query_submitted', {
                organization,
                natural_language_query: searchQuery.trim(),
              });
              submitQuery(searchQuery.trim());
              state.open();
              return;
            }

            state.open();
            return;
          default:
            return;
        }
      },
    },
    state
  );

  const {
    overlayProps,
    triggerProps,
    update: updateOverlayPosition,
  } = useOverlay({
    type: 'listbox',
    isOpen: state.isOpen,
    position: 'bottom-start',
    offset: 2,
    shouldCloseOnBlur: true,
    shouldApplyMinWidth: false,
    isKeyboardDismissDisabled: true,
    preventOverflowOptions: {boundary: document.body},
    flipOptions: {
      // We don't want the menu to ever flip to the other side of the input
      fallbackPlacements: [],
    },
    shouldCloseOnInteractOutside: el => {
      if (popoverRef.current?.contains(el) || containerRef.current?.contains(el)) {
        return false;
      }
      return true;
    },
    onInteractOutside: () => {
      state.close();
    },
  });

  useUpdateOverlayPositionOnContentChange({
    contentRef: popoverRef,
    updateOverlayPosition,
    isOpen: state.isOpen,
  });

  useLayoutEffect(() => {
    if (!state.isOpen && inputRef.current && isInitialRender.current) {
      isInitialRender.current = false;
      inputRef.current?.focus();
      state.open();
    }
  }, [state]);

  return (
    <Wrapper ref={containerRef} isDropdownOpen={state.isOpen}>
      <PositionedSearchIconContainer>
        <SearchIcon size="sm" />
      </PositionedSearchIconContainer>
      <InputWrapper>
        <InvisibleInput
          {...inputProps}
          autoComplete="off"
          onClick={() => state.open()}
          placeholder={t('Ask Seer with Natural Language')}
          ref={mergeRefs(inputRef, triggerProps.ref as React.Ref<HTMLInputElement>)}
        />
      </InputWrapper>
      <ButtonsWrapper>
        <Button
          size="xs"
          icon={<IconClose />}
          onFocus={() => !state.isOpen && state.open()}
          onClick={() => {
            trackAnalytics('trace.explorer.ai_query_interface', {
              organization,
              action: 'closed',
            });
            setDisplaySeerResults(false);
          }}
          aria-label={t('Close Seer Search')}
          borderless
        />
      </ButtonsWrapper>
      {state.isOpen ? (
        <SeerSearchPopover
          isNonModal
          state={state}
          triggerRef={inputRef}
          popoverRef={popoverRef}
          containerRef={containerRef}
          overlayProps={overlayProps}
        >
          {isPending ? (
            <SeerSearchSkeleton />
          ) : rawResult && (rawResult?.length ?? 0) > 0 ? (
            <Fragment>
              <SeerSearchHeader title={t('Do any of these queries look right to you?')} />
              <SeerSearchListBox
                {...listBoxProps}
                listBoxRef={listBoxRef}
                state={state}
              />
            </Fragment>
          ) : (
            <SeerContent>
              <SeerSearchHeader
                title={t("Describe what you're looking for!")}
                handleExampleClick={handleExampleClick}
              />
            </SeerContent>
          )}
          <SeerFooter>
            {openForm && (
              <Button
                size="xs"
                icon={<IconMegaphone />}
                onClick={() =>
                  openForm({
                    messagePlaceholder: t('How can we make Seer search better for you?'),
                    tags: {
                      ['feedback.source']: 'seer_trace_explorer_search',
                      ['feedback.owner']: 'ml-ai',
                    },
                  })
                }
              >
                {t('Give Feedback')}
              </Button>
            )}
          </SeerFooter>
        </SeerSearchPopover>
      ) : null}
    </Wrapper>
  );
}

const Wrapper = styled(Input.withComponent('div'))<{isDropdownOpen: boolean}>`
  min-height: ${p => p.theme.form.md.minHeight};
  padding: 0;
  height: auto;
  width: 100%;
  position: relative;
  font-size: ${p => p.theme.fontSize.md};
  cursor: text;

  border-bottom-left-radius: ${p => (p.isDropdownOpen ? '0' : p.theme.borderRadius)};
  border-bottom-right-radius: ${p => (p.isDropdownOpen ? '0' : p.theme.borderRadius)};
`;

const PositionedSearchIconContainer = styled('div')`
  position: absolute;
  left: ${p => p.theme.space.lg};
  top: ${p => (p.theme.isChonk ? p.theme.space.sm : p.theme.space.md)};
`;

const SearchIcon = styled(IconSearch)`
  color: ${p => p.theme.subText};
  height: 22px;
`;

const InputWrapper = styled('div')`
  position: relative;
  width: 100%;
  height: 100%;
`;

const InvisibleInput = styled('input')`
  position: absolute;
  inset: 0;
  resize: none;
  outline: none;
  border: 0;
  width: 100%;
  height: ${p => p.theme.form.md.height};
  line-height: 25px;
  margin-bottom: -1px;
  background: transparent;

  padding-top: ${p => p.theme.space.sm};
  padding-bottom: ${p => p.theme.space.sm};
  padding-left: ${p => p.theme.space['3xl']};
  padding-right: ${p => p.theme.space.sm};

  &::selection {
    background: rgba(0, 0, 0, 0.2);
  }

  :placeholder-shown {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [disabled] {
    color: ${p => p.theme.disabled};
  }
`;

const ButtonsWrapper = styled('div')`
  position: absolute;
  right: 9px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const SeerFooter = styled('div')`
  display: flex;
  justify-content: flex-end;
  padding: ${p => p.theme.space.lg};
  border-top: 1px solid ${p => p.theme.border};
`;

const SeerContent = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
`;
