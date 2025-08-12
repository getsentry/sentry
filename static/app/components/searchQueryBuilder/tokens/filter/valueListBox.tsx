import {Fragment, useCallback} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';
import {isMac} from '@react-aria/utils';

import {ListBox} from 'sentry/components/core/compactSelect/listBox';
import type {SelectOptionOrSectionWithKey} from 'sentry/components/core/compactSelect/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Overlay} from 'sentry/components/overlay';
import type {CustomComboboxMenuProps} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import {itemIsSection} from 'sentry/components/searchQueryBuilder/tokens/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface ConstrainAndAlignListBoxArgs {
  popoverRef: React.RefObject<HTMLElement | null>;
  referenceRef: React.RefObject<HTMLElement | null>;
  refsToSync: Array<React.RefObject<HTMLElement | null>>;
}

function constrainAndAlignListBox({
  popoverRef,
  referenceRef,
  refsToSync,
}: ConstrainAndAlignListBoxArgs) {
  if (!referenceRef.current || !popoverRef.current) return;

  const referenceRect = referenceRef.current.getBoundingClientRect();
  const popoverRect = popoverRef.current.getBoundingClientRect();

  refsToSync.forEach(ref => {
    if (!ref.current) return;
    ref.current.style.maxWidth = `${referenceRect.width}px`;
  });

  // Align popover position when it's width is constrained
  if (popoverRect.width === referenceRect.width) {
    const parentOfTarget = popoverRef.current.offsetParent || document.documentElement;
    const parentRect = parentOfTarget.getBoundingClientRect();

    const sourceCenterViewport = referenceRect.left + referenceRect.width / 2;
    const desiredTargetLeftViewport = sourceCenterViewport - popoverRect.width / 2;
    const newX = desiredTargetLeftViewport - parentRect.left;

    popoverRef.current.style.left = `${newX}px`;
  } else {
    popoverRef.current.style.left = 'auto';
  }
}

interface ValueListBoxProps<T> extends CustomComboboxMenuProps<T> {
  canUseWildcard: boolean;
  isLoading: boolean;
  isMultiSelect: boolean;
  items: T[];
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  portalTarget?: HTMLElement | null;
}

function Footer({
  isMultiSelect,
  canUseWildcard,
}: {
  canUseWildcard: boolean;
  isMultiSelect: boolean;
}) {
  if (!isMultiSelect && !canUseWildcard) {
    return null;
  }

  return (
    <FooterContainer>
      {isMultiSelect ? (
        <Label>{t('Hold %s to select multiple', isMac() ? '⌘' : 'Ctrl')}</Label>
      ) : null}
      <Label>{t('Type to search suggestions')}</Label>
      {canUseWildcard ? <Label>{t('Wildcard (*) matching allowed')}</Label> : null}
    </FooterContainer>
  );
}

export function ValueListBox<T extends SelectOptionOrSectionWithKey<string>>({
  hiddenOptions,
  isOpen,
  isLoading,
  listBoxProps,
  listBoxRef,
  popoverRef,
  state,
  overlayProps,
  filterValue,
  isMultiSelect,
  items,
  canUseWildcard,
  portalTarget,
  wrapperRef,
}: ValueListBoxProps<T>) {
  const totalOptions = items.reduce(
    (acc, item) => acc + (itemIsSection(item) ? item.options.length : 1),
    0
  );
  const anyItemsShowing = totalOptions > hiddenOptions.size;

  const listBoxRefCallback = useCallback(
    (element: HTMLUListElement | null) => {
      listBoxRef.current = element;

      if (!element) return undefined;

      const refsToSync = [listBoxRef, popoverRef];

      constrainAndAlignListBox({
        popoverRef,
        refsToSync,
        referenceRef: wrapperRef,
      });

      const observer = new ResizeObserver(() => {
        constrainAndAlignListBox({
          popoverRef,
          refsToSync,
          referenceRef: wrapperRef,
        });
      });

      observer.observe(element);

      return () => {
        observer.disconnect();
      };
    },
    [listBoxRef, popoverRef, wrapperRef]
  );

  if (!isOpen || (!anyItemsShowing && !isLoading)) {
    return null;
  }

  const valueListBoxContent = (
    <StyledPositionWrapper {...overlayProps} visible={isOpen}>
      <SectionedOverlay ref={popoverRef}>
        {isLoading && hiddenOptions.size >= totalOptions ? (
          <LoadingWrapper>
            <LoadingIndicator size={24} />
          </LoadingWrapper>
        ) : (
          <Fragment>
            <StyledListBox
              {...listBoxProps}
              ref={listBoxRefCallback}
              listState={state}
              hasSearch={!!filterValue}
              hiddenOptions={hiddenOptions}
              keyDownHandler={() => true}
              overlayIsOpen={isOpen}
              showSectionHeaders={!filterValue}
              size="sm"
              style={{maxWidth: overlayProps.style!.maxWidth}}
            />
            {isLoading && anyItemsShowing ? (
              <LoadingWrapper height="32px" width="100%">
                <LoadingIndicator size={24} />
              </LoadingWrapper>
            ) : null}
            <Footer isMultiSelect={isMultiSelect} canUseWildcard={canUseWildcard} />
          </Fragment>
        )}
      </SectionedOverlay>
    </StyledPositionWrapper>
  );

  if (portalTarget) {
    return createPortal(valueListBoxContent, portalTarget);
  }

  return valueListBoxContent;
}

const SectionedOverlay = styled(Overlay)`
  display: grid;
  grid-template-rows: 1fr auto;
  overflow: hidden;
  max-height: 340px;
  width: min-content;
`;

const StyledListBox = styled(ListBox)`
  width: min-content;
  min-width: 200px;
`;

const StyledPositionWrapper = styled('div')<{visible?: boolean}>`
  display: ${p => (p.visible ? 'block' : 'none')};
  z-index: ${p => p.theme.zIndex.tooltip};
`;

const FooterContainer = styled('div')`
  padding: ${space(1)} ${space(2)};
  color: ${p => p.theme.subText};
  border-top: 1px solid ${p => p.theme.innerBorder};
  font-size: ${p => p.theme.fontSize.sm};
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const LoadingWrapper = styled('div')<{height?: string; width?: string}>`
  display: flex;
  justify-content: center;
  align-items: center;
  height: ${p => p.height ?? '140px'};
  width: ${p => p.width ?? '200px'};
`;

const Label = styled('div')``;
