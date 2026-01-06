import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {type AriaComboBoxProps} from '@react-aria/combobox';
import {mergeRefs} from '@react-aria/utils';
import {Item} from '@react-stately/collections';
import {useComboBoxState} from '@react-stately/combobox';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {Text} from 'sentry/components/core/text';
import {AskSeerSearchHeader} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerSearchHeader';
import {AskSeerSearchListBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerSearchListBox';
import {AskSeerSearchPopover} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerSearchPopover';
import {AskSeerSearchSkeleton} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerSearchSkeleton';
import QueryTokens from 'sentry/components/searchQueryBuilder/askSeerCombobox/queryTokens';
import type {
  AskSeerSearchItems,
  QueryTokensProps,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {
  formatQueryToNaturalLanguage,
  generateQueryTokensString,
  isNoneOfTheseItem,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/utils';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useSearchTokenCombobox} from 'sentry/components/searchQueryBuilder/tokens/useSearchTokenCombobox';
import {IconClose, IconMegaphone, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useMutation, type MutationOptions} from 'sentry/utils/queryClient';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import useOverlay from 'sentry/utils/useOverlay';

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

interface AskSeerComboBoxProps<T extends QueryTokensProps>
  extends Omit<AriaComboBoxProps<unknown>, 'children'> {
  /**
   * The source of the analytics event, must be a dot-separated identifier like "trace.
   * explorer" or "issue.list"
   * @example 'trace.explorer'
   *
   * The combobox has the following analytic events, that will need to be tracked with your provided analyticsSource:
   * - `<analyticsSource>.ai_query_rejected`
   * - `<analyticsSource>.ai_query_interface`
   * - `<analyticsSource>.ai_query_submitted`
   */
  analyticsSource: string;
  applySeerSearchQuery: (item: T) => void;
  askSeerMutationOptions: MutationOptions<
    {
      queries: T[];
      status: string;
      unsupported_reason: string | null;
    },
    Error,
    string
  >;
  /**
   * The owner of the feedback form, must be an underscore-separated identifier like
   * "trace_explorer_ai_query" or "issue_list_ai_query"
   *
   * @example 'trace_explorer_ai_query'
   */
  feedbackSource: string;
  initialQuery: string;
}

export function AskSeerComboBox<T extends QueryTokensProps>({
  initialQuery,
  feedbackSource,
  analyticsSource,
  ...props
}: AskSeerComboBoxProps<T>) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listBoxRef = useRef<HTMLUListElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLInputElement>(null);
  const isInitialRender = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const organization = useOrganization();

  const [searchQuery, setSearchQuery] = useState(() =>
    formatQueryToNaturalLanguage(initialQuery)
  );

  const openForm = useFeedbackForm();

  const {
    setDisplayAskSeer,
    setDisplayAskSeerFeedback,
    askSeerNLQueryRef,
    autoSubmitSeer,
    setAutoSubmitSeer,
    enableAISearch,
  } = useSearchQueryBuilder();

  const {
    mutate: submitQuery,
    data,
    isPending,
    isError,
  } = useMutation({
    ...props.askSeerMutationOptions,
    onError: (error, variables, context) => {
      props.askSeerMutationOptions.onError?.(error, variables, context);
      addErrorMessage(t('Failed to process AI query: %(error)s', {error: error.message}));
    },
  });

  const handleNoneOfTheseClick = () => {
    if (openForm) {
      openForm({
        messagePlaceholder: t('Why were these queries incorrect?'),
        tags: {
          ['feedback.source']: feedbackSource,
          ['feedback.owner']: 'ml-ai',
          ['feedback.natural_language_query']: searchQuery,
          ['feedback.raw_result']: JSON.stringify(data?.queries).replace(/\n/g, ''),
          ['feedback.num_queries_returned']: data?.queries?.length ?? 0,
        },
      });
    } else {
      addErrorMessage(t('Unable to open feedback form'));
    }
  };

  const items: Array<AskSeerSearchItems<T>> = useMemo(() => {
    if (data?.queries && data?.queries.length > 0) {
      const results: Array<AskSeerSearchItems<T>> = data?.queries.map((query, index) => ({
        ...query,
        key: `${index}-${query.query}`,
      }));

      results.push({
        key: 'none-of-these',
        label: t('None of these'),
      });

      return results;
    }

    return [];
  }, [data?.queries]);

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
    onSelectionChange(key) {
      if (typeof key !== 'string') return;

      if (key === 'none-of-these') {
        trackAnalytics(`${analyticsSource}.ai_query_rejected`, {
          organization,
          natural_language_query: searchQuery,
          num_queries_returned: data?.queries?.length ?? 0,
        });
        handleNoneOfTheseClick();
        return;
      }

      const item = items.find(i => i.key === key);
      if (!item || isNoneOfTheseItem(item)) {
        addErrorMessage(t('Failed to find AI query to apply'));
        return;
      }

      askSeerNLQueryRef.current = searchQuery.trim();
      props.applySeerSearchQuery(item);
      setDisplayAskSeerFeedback(true);
      setDisplayAskSeer(false);
      state.close();
    },
    children: item => {
      if (isNoneOfTheseItem(item)) {
        return (
          <Item key={item.key} textValue={item.label} data-is-none-of-these>
            <Text variant="muted">{item.label}</Text>
          </Item>
        );
      }

      const readableQuery = generateQueryTokensString(item);

      return (
        <Item
          key={item.key}
          textValue={readableQuery}
          aria-label={`Query parameters: ${readableQuery}`}
        >
          <QueryTokens
            sort={item?.sort}
            query={item?.query}
            groupBys={item?.groupBys}
            statsPeriod={item?.statsPeriod}
            start={item?.start}
            end={item?.end}
            visualizations={item?.visualizations}
          />
        </Item>
      );
    },
  });

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
              trackAnalytics(`${analyticsSource}.ai_query_interface`, {
                organization,
                action: 'closed',
              });
              setDisplayAskSeerFeedback(false);
              setDisplayAskSeer(false);
            }

            state.close();
            return;
          case 'Enter':
            if (state.isOpen && state.selectionManager.focusedKey === 'none-of-these') {
              trackAnalytics(`${analyticsSource}.ai_query_rejected`, {
                organization,
                natural_language_query: searchQuery,
                num_queries_returned: data?.queries?.length ?? 0,
              });
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

              askSeerNLQueryRef.current = searchQuery.trim();
              props.applySeerSearchQuery(item);
              setDisplayAskSeerFeedback(true);
              setDisplayAskSeer(false);
              state.close();
              return;
            }

            if (
              state.isOpen &&
              searchQuery.trim() !== null &&
              searchQuery.trim() !== ''
            ) {
              trackAnalytics(`${analyticsSource}.ai_query_submitted`, {
                organization,
                natural_language_query: searchQuery.trim(),
              });
              askSeerNLQueryRef.current = searchQuery.trim();
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

  useLayoutEffect(() => {
    if (autoSubmitSeer && searchQuery.trim()) {
      trackAnalytics(`${analyticsSource}.ai_query_submitted`, {
        organization,
        natural_language_query: searchQuery.trim(),
      });
      submitQuery(searchQuery.trim());
      setAutoSubmitSeer(false);
    }
  }, [
    analyticsSource,
    autoSubmitSeer,
    organization,
    searchQuery,
    setAutoSubmitSeer,
    submitQuery,
  ]);

  const onMouseLeave = () => {
    state.selectionManager.setFocusedKey(null);
  };

  if (!enableAISearch) {
    return null;
  }

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
            trackAnalytics(`${analyticsSource}.ai_query_interface`, {
              organization,
              action: 'closed',
            });
            setDisplayAskSeerFeedback(false);
            setDisplayAskSeer(false);
          }}
          aria-label={t('Close Seer Search')}
          borderless
        />
      </ButtonsWrapper>
      {state.isOpen ? (
        <AskSeerSearchPopover
          isNonModal
          state={state}
          triggerRef={inputRef}
          popoverRef={popoverRef}
          containerRef={containerRef}
          overlayProps={overlayProps}
        >
          {isPending ? (
            <SeerContent>
              <AskSeerSearchHeader title={t('Let me think about that...')} loading />
              <AskSeerSearchSkeleton />
            </SeerContent>
          ) : isError ? (
            <SeerContent>
              <AskSeerSearchHeader
                title={t('An error occurred while fetching Seer queries')}
              />
            </SeerContent>
          ) : data?.queries && (data?.queries?.length ?? 0) > 0 ? (
            <SeerContent onMouseLeave={onMouseLeave}>
              <AskSeerSearchHeader title={t('Do any of these look right to you?')} />
              <AskSeerSearchListBox
                {...listBoxProps}
                listBoxRef={listBoxRef}
                state={state}
              />
            </SeerContent>
          ) : data?.unsupported_reason ? (
            <SeerContent>
              <AskSeerSearchHeader
                title={data?.unsupported_reason || 'This query is not supported'}
              />
            </SeerContent>
          ) : (
            <SeerContent onMouseLeave={onMouseLeave}>
              <AskSeerSearchHeader title={t("Describe what you're looking for.")} />
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
                      ['feedback.source']: feedbackSource,
                      ['feedback.owner']: 'ml-ai',
                    },
                  })
                }
              >
                {t('Give Feedback')}
              </Button>
            )}
          </SeerFooter>
        </AskSeerSearchPopover>
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

  border-bottom-left-radius: ${p => (p.isDropdownOpen ? '0' : p.theme.radius.md)};
  border-bottom-right-radius: ${p => (p.isDropdownOpen ? '0' : p.theme.radius.md)};
`;

const PositionedSearchIconContainer = styled('div')`
  position: absolute;
  left: ${p => p.theme.space.lg};
  top: ${p => p.theme.space.sm};
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
  padding: ${p => p.theme.space.md};
  border-top: 1px solid ${p => p.theme.border};
  background-color: ${p => p.theme.tokens.background.primary};
`;

const SeerContent = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
`;
