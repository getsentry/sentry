import type * as React from 'react';
import {createPortal} from 'react-dom';
import {type CSSObject, useTheme} from '@emotion/react';
import type {useListBox} from '@react-aria/listbox';
import type {ListState} from '@react-stately/list';
import type {Key} from '@react-types/shared';

import {PanelProvider} from '@sentry/scraps/panelProvider';
import type {FormSize} from '@sentry/scraps/theme';
import {useTranslation} from '@sentry/scraps/translation';
import {type VirtualCollection, VirtualRows} from '@sentry/scraps/useVirtualCollection';

import {SelectOption, SelectSection} from './option';
import {CREATE_KEY} from './options';
import type {getSelectStyles} from './styles';
import type {SelectComponents, SelectValue, StylesConfig} from './types';

export const MENU_GAP = 8;

export function SelectMenu<TValue, TOption extends SelectValue<TValue>>({
  controlRef,
  footerRef,
  inputRef,
  isInsideModal,
  isLoading,
  listBoxProps,
  listRef,
  loadingMessage,
  lockedMenuWidth,
  maxMenuHeight,
  menuFooter,
  menuPortalTarget,
  menuRef,
  menuStyle,
  minMenuHeight,
  multiple,
  noOptionsMessage,
  onClose,
  OptionLabel,
  overlayStyle,
  query,
  rowsByKey,
  selectStyles,
  setOverlayElement,
  showCreateOptionIcon,
  showDividers,
  size,
  state,
  styles,
  virtual,
  virtualized,
}: {
  controlRef: React.RefObject<HTMLDivElement | null>;
  footerRef: React.Ref<HTMLDivElement>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  listBoxProps: ReturnType<typeof useListBox>['listBoxProps'];
  listRef: React.Ref<HTMLUListElement>;
  maxMenuHeight: number;
  menuRef: React.Ref<HTMLDivElement>;
  menuStyle: CSSObject;
  multiple: boolean;
  onClose: () => void;
  query: string;
  rowsByKey: ReadonlyMap<Key, TOption>;
  selectStyles: Pick<
    ReturnType<typeof getSelectStyles>,
    'heading' | 'menuList' | 'message'
  >;
  setOverlayElement: React.Ref<HTMLDivElement>;
  size: FormSize;
  state: ListState<unknown>;
  virtual: VirtualCollection<unknown>;
  virtualized: boolean;
  OptionLabel?: SelectComponents<TOption>['OptionLabel'];
  isInsideModal?: boolean;
  isLoading?: boolean;
  loadingMessage?: () => React.ReactNode;
  lockedMenuWidth?: number;
  menuFooter?: React.ReactNode;
  menuPortalTarget?: HTMLElement | null;
  minMenuHeight?: number;
  noOptionsMessage?: (state: {inputValue: string}) => React.ReactNode;
  overlayStyle?: React.CSSProperties;
  showCreateOptionIcon?: boolean;
  showDividers?: boolean;
  styles?: StylesConfig<TValue, TOption>;
}) {
  const {t} = useTranslation();
  const theme = useTheme();

  const lockedMenuStyle =
    lockedMenuWidth === undefined
      ? undefined
      : {width: lockedMenuWidth, maxWidth: menuStyle.maxWidth ?? '100%'};
  const positionStyle: CSSObject = {
    ...(menuStyle.position === 'initial' ? {marginBlockStart: MENU_GAP} : overlayStyle),
    display: 'flex',
    flexDirection: 'column',
    zIndex: isInsideModal ? theme.zIndex.modal + 1 : theme.zIndex.dropdown,
  };
  const menuListStyle = {
    ...selectStyles.menuList,
    maxHeight: maxMenuHeight,
    minHeight: minMenuHeight ?? 0,
  };
  const menu = (
    <div
      ref={setOverlayElement}
      data-overlay-root=""
      css={
        menuPortalTarget
          ? (styles?.menuPortal?.(positionStyle, {}) ?? positionStyle)
          : positionStyle
      }
      onKeyDown={event => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          event.stopPropagation();
          inputRef.current?.focus();
          onClose();
        }
      }}
      onBlur={event => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          !controlRef.current?.contains(event.relatedTarget)
        ) {
          onClose();
        }
      }}
    >
      <PanelProvider>
        <div ref={menuRef} css={[menuStyle, lockedMenuStyle]}>
          <ul
            {...listBoxProps}
            ref={listRef}
            css={styles?.menuList?.(menuListStyle, {}) ?? menuListStyle}
          >
            <VirtualRows
              virtual={virtual}
              renderRow={row => (
                <SelectOption
                  row={row}
                  state={state}
                  option={rowsByKey.get(row.node.key)}
                  size={size}
                  multiple={multiple}
                  virtualized={virtualized}
                  showDividers={showDividers}
                  showCreateOptionIcon={showCreateOptionIcon}
                  OptionLabel={OptionLabel}
                  styleOption={styles?.option}
                  create={row.node.key === CREATE_KEY}
                />
              )}
              renderSection={(section, children) => (
                <SelectSection
                  row={section}
                  headingStyle={
                    styles?.groupHeading?.(selectStyles.heading, {}) ??
                    selectStyles.heading
                  }
                >
                  {children}
                </SelectSection>
              )}
            />
          </ul>
          {state.collection.size === 0 && (
            <div role="status" css={selectStyles.message}>
              {isLoading
                ? loadingMessage
                  ? loadingMessage()
                  : t('Loading...')
                : noOptionsMessage
                  ? noOptionsMessage({inputValue: query})
                  : t('No options')}
            </div>
          )}
          {menuFooter && <div ref={footerRef}>{menuFooter}</div>}
        </div>
      </PanelProvider>
    </div>
  );

  return menuPortalTarget ? createPortal(menu, menuPortalTarget) : menu;
}
