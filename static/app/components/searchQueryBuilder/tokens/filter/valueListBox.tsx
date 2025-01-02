import {Fragment} from 'react';
import styled from '@emotion/styled';
import {isMac} from '@react-aria/utils';

import {ListBox} from 'sentry/components/compactSelect/listBox';
import type {SelectOptionOrSectionWithKey} from 'sentry/components/compactSelect/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Overlay} from 'sentry/components/overlay';
import type {CustomComboboxMenuProps} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import {itemIsSection} from 'sentry/components/searchQueryBuilder/tokens/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface ValueListBoxProps<T> extends CustomComboboxMenuProps<T> {
  canUseWildcard: boolean;
  isLoading: boolean;
  isMultiSelect: boolean;
  items: T[];
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
}: ValueListBoxProps<T>) {
  const totalOptions = items.reduce(
    (acc, item) => acc + (itemIsSection(item) ? item.options.length : 1),
    0
  );
  const anyItemsShowing = totalOptions > hiddenOptions.size;

  if (!isOpen || (!anyItemsShowing && !isLoading)) {
    return null;
  }

  return (
    <StyledPositionWrapper {...overlayProps} visible={isOpen}>
      <SectionedOverlay ref={popoverRef}>
        {isLoading && hiddenOptions.size >= totalOptions ? (
          <LoadingWrapper>
            <LoadingIndicator mini />
          </LoadingWrapper>
        ) : (
          <Fragment>
            <StyledListBox
              {...listBoxProps}
              ref={listBoxRef}
              listState={state}
              hasSearch={!!filterValue}
              hiddenOptions={hiddenOptions}
              keyDownHandler={() => true}
              overlayIsOpen={isOpen}
              showSectionHeaders={!filterValue}
              size="sm"
              style={{maxWidth: overlayProps.style!.maxWidth}}
            />
            <Footer isMultiSelect={isMultiSelect} canUseWildcard={canUseWildcard} />
          </Fragment>
        )}
      </SectionedOverlay>
    </StyledPositionWrapper>
  );
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
  font-size: ${p => p.theme.fontSizeSmall};
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const LoadingWrapper = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 140px;
  width: 200px;
`;

const Label = styled('div')``;
