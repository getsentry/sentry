import {Fragment, useCallback, useContext, useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import {useListBox, useListBoxSection, useOption} from '@react-aria/listbox';
import {isMac} from '@react-aria/utils';
import {Item, Section} from '@react-stately/collections';
import {TreeProps, TreeState, useTreeState} from '@react-stately/tree';
import {Node} from '@react-types/shared';

import {closeModal} from 'sentry/actionCreators/modal';
import {navigateTo} from 'sentry/actionCreators/navigation';
import MenuListItem from 'sentry/components/menuListItem';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useRouter from 'sentry/utils/useRouter';

import {OmniAction, OmniSection} from '../types';
import {useOmniSearchState} from '../useOmniState';

import {OnmniSearchInputContext} from './index';
/**
 * Maps keyboard event `key` to correspinding unicode glyphs.
 * See https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
 */
const keyboardGlyphs = {
  shift: '⇧',
  backspace: '⌫',
  ArrowLeft: '←',
  ArrowUp: '↑',
  ArrowRight: '→',
  ArrowDown: '↓',
};

const macKeyboardGlyphs = {
  ...keyboardGlyphs,
  alt: '⌥',
  control: '⌃',
  cmd: '⌘',
};

const windowsKeyboardGlyphs = {
  ...keyboardGlyphs,
  Alt: 'Alt',
  Control: 'Ctrl',
  Meta: '❖',
};

interface OmniResultsProps {
  results: OmniSection[];
}

function OmniResults({results}: OmniResultsProps) {
  return (
    <OmniResultsList>
      {results.map(({key: sectionKey, ...section}) => (
        <Section key={sectionKey} title={section.label}>
          {section.actions.map(({key: actionKey, ...action}) => (
            <Item<OmniAction> key={actionKey} {...action}>
              {action.label}
            </Item>
          ))}
        </Section>
      ))}
    </OmniResultsList>
  );
}

function OmniResultsList(props: TreeProps<OmniSection>) {
  const {focusedArea} = useOmniSearchState();
  const setSearch = useContext(OnmniSearchInputContext);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const state = useTreeState(props);
  const collection = [...state.collection];

  const onAction = useCallback(
    selection => {
      const selectedOption = [...state.collection]
        .map(section => [...section.childNodes])
        .flat()
        .find(item => item.key === selection)?.props;

      if (selectedOption.to) {
        navigateTo(selectedOption.to, router);
        return;
      }

      selectedOption.onAction?.();
      closeModal();
    },
    [state, router]
  );

  const {listBoxProps} = useListBox(
    {
      'aria-label': t('Search results'),
      autoFocus: true,
      shouldFocusOnHover: true,
      shouldUseVirtualFocus: true,
      shouldSelectOnPressUp: false,
      shouldFocusWrap: true,
      selectionMode: 'none',
      onAction,
    },
    state,
    inputRef
  );

  useEffect(() => {
    if (!inputRef.current) {
      return;
    }

    inputRef.current.focus();
    // Focus on first focusable item
    const firstItem = state.collection.at(0);
    const firstFocusableItem =
      firstItem?.type === 'section' ? [...firstItem.childNodes][0] : firstItem;
    firstFocusableItem && state.selectionManager.setFocusedKey(firstFocusableItem.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.collection]);

  return (
    <Fragment>
      <OmniHeader hasFocusedArea={!!focusedArea}>
        {focusedArea && <OmniFocusedAreaLabel>{focusedArea.label}</OmniFocusedAreaLabel>}
        <OmniInput
          ref={inputRef}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search for anything…"
          onKeyDown={e => {
            if (['Enter', 'Tab'].includes(e.key)) {
              e.preventDefault();
              onAction(state.selectionManager.focusedKey);
            }
            listBoxProps.onKeyDown?.(e);
          }}
        />
      </OmniHeader>

      <ResultsList {...listBoxProps}>
        {collection.map(item => (
          <OmniResultSection key={item.key} section={item} state={state} />
        ))}
      </ResultsList>
    </Fragment>
  );
}

interface OmniResultSectionProps {
  section: Node<OmniSection>;
  state: TreeState<OmniSection>;
}

function OmniResultSection({section, state}: OmniResultSectionProps) {
  const {itemProps, headingProps, groupProps} = useListBoxSection({
    heading: section.rendered,
    'aria-label': section['aria-label'],
  });

  return (
    <ResultSection {...itemProps} hasHeading={!!section.rendered}>
      {section.rendered && (
        <ResultSectionLabel {...headingProps}>{section.rendered}</ResultSectionLabel>
      )}
      <ResultSectionList {...groupProps}>
        {[...section.childNodes].map(item => (
          <OmniResultOption key={item.key} item={item} state={state} />
        ))}
      </ResultSectionList>
    </ResultSection>
  );
}

interface OmniResultOptionProps {
  item: Node<OmniSection>;
  state: TreeState<OmniSection>;
}

function OmniResultOption({item, state}: OmniResultOptionProps) {
  const {actionIcon: Icon, actionHotkey} = item.props as OmniAction;
  const optionRef = useRef<HTMLLIElement>(null);
  const {optionProps, isFocused, isPressed, isSelected, isDisabled} = useOption(
    {key: item.key},
    state,
    optionRef
  );

  const keyboardShortcutGlyphs = isMac() ? macKeyboardGlyphs : windowsKeyboardGlyphs;
  const keyboardShortcutIsChain = actionHotkey?.includes(',');
  const keyboardShortcut = keyboardShortcutIsChain
    ? actionHotkey?.split?.(',')
    : actionHotkey?.split?.('+');

  return (
    <MenuListItem
      ref={optionRef}
      disabled={isDisabled}
      isFocused={isFocused}
      isSelected={isSelected}
      isPressed={isPressed}
      label={item.rendered}
      leadingItems={
        Icon && (
          <IconWrap>
            <Icon size="sm" />
          </IconWrap>
        )
      }
      trailingItems={
        keyboardShortcut && (
          <KeyboardShortcutWrap>
            {keyboardShortcut.map((key, index) => (
              <Fragment key={index}>
                <KeyboardShortcutKey isSymbol={!!keyboardShortcutGlyphs[key]}>
                  {keyboardShortcutGlyphs[key] ?? key}
                </KeyboardShortcutKey>
                {keyboardShortcutIsChain &&
                  index < keyboardShortcut.length - 1 &&
                  t('then')}
              </Fragment>
            ))}
          </KeyboardShortcutWrap>
        )
      }
      {...optionProps}
    />
  );
}

export {OmniResults};

const OmniHeader = styled('div')<{hasFocusedArea: boolean}>`
  display: flex;
  flex-direction: column;
  align-items: start;
  box-shadow: 0 1px 0 0 ${p => p.theme.translucentInnerBorder};
  z-index: 2;
  ${p => p.hasFocusedArea && `padding-top: ${space(1.5)};`}
`;

const OmniFocusedAreaLabel = styled('p')`
  margin-bottom: 0;
  margin-left: ${space(1.5)};
  padding: 0 ${space(0.5)};
  box-shadow: 0 0 0 1px ${p => p.theme.translucentInnerBorder};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: 2px;

  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  line-height: 1.5;
`;

const OmniInput = styled('input')`
  width: 100%;
  background: transparent;
  padding: ${space(1)} ${space(2)};
  border: none;

  font-size: ${p => p.theme.fontSizeLarge};
  line-height: 2;

  &:focus {
    outline: none;
  }
`;

const ResultsList = styled('ul')`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: min(calc(100vh - 128px - 4rem), 400px);
  overflow: auto;
  padding: ${space(0.5)} 0;
  margin: 0;
`;

const ResultSection = styled('li')<{hasHeading?: boolean}>`
  position: relative;
  list-style-type: none;
  padding: ${space(1.5)} 0;

  &:first-of-type {
    padding-top: ${space(1)};
  }

  &:last-of-type {
    padding-bottom: 0;
  }

  ${p =>
    !p.hasHeading &&
    `&& {
      padding-top: ${space(0.5)};
    }`};

  &:not(:last-of-type)::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: ${space(1.5)};
    right: ${space(1.5)};
    border-bottom: solid 1px ${p => p.theme.translucentInnerBorder};
  }
`;

const ResultSectionLabel = styled('label')`
  display: block;
  margin-left: ${space(2)};
  margin-bottom: ${space(0.5)};

  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  font-weight: 600;
  text-transform: uppercase;
`;

const ResultSectionList = styled('ul')`
  padding: 0;
  margin: 0;
`;

const IconWrap = styled('div')`
  display: flex;
  align-items: center;
  margin-right: ${space(0.5)};
  margin-bottom: ${space(0.25)};
`;

const KeyboardShortcutWrap = styled('div')`
  display: flex;
  gap: ${space(0.75)};
  align-items: baseline;
  color: ${p => p.theme.subText};
`;

const KeyboardShortcutKey = styled('kbd')<{isSymbol: boolean}>`
  height: 1.2rem;
  ${p =>
    !p.isSymbol &&
    `
    width: 1.1rem;
    text-transform: uppercase;
  `}
  display: flex;
  align-items: center;
  justify-content: center;

  padding: 0 ${space(0.5)};
  border-radius: 2px;
  box-shadow: 0 0 0 1px ${p => p.theme.translucentInnerBorder};
  background: ${p => p.theme.backgroundElevated}D9;

  font-family: system-ui;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  line-height: 1;
`;
