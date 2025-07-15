import type {Key} from 'react';
import {useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {type AriaComboBoxProps} from '@react-aria/combobox';
import {Item, Section} from '@react-stately/collections';
import {useComboBoxState} from '@react-stately/combobox';
import type {CollectionChildren} from '@react-types/shared';

import {Badge} from 'sentry/components/core/badge';
import {ListBox} from 'sentry/components/core/compactSelect/listBox';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Overlay} from 'sentry/components/overlay';
import {useSearchTokenCombobox} from 'sentry/components/searchQueryBuilder/tokens/useSearchTokenCombobox';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {StoryTreeNode} from 'sentry/stories/view/storyTree';
import {space} from 'sentry/styles/space';
import {fzf} from 'sentry/utils/profiling/fzf/fzf';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useNavigate} from 'sentry/utils/useNavigate';

import {useStoryBookFilesByCategory} from './storySidebar';

interface StorySection {
  key: string;
  label: string;
  options: StoryTreeNode[];
}

function isStorySection(item: StoryTreeNode | StorySection): item is StorySection {
  return 'options' in item;
}

export function StorySearch() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const {
    foundations: foundationsTree,
    core: coreTree,
    shared: sharedTree,
  } = useStoryBookFilesByCategory();
  const foundations = useMemo(
    () => foundationsTree.flatMap(tree => tree.flat()),
    [foundationsTree]
  );
  const core = useMemo(() => coreTree.flatMap(tree => tree.flat()), [coreTree]);
  const shared = useMemo(() => sharedTree.flatMap(tree => tree.flat()), [sharedTree]);

  const storiesSearchHotkeys = useMemo(() => {
    return [{match: '/', callback: () => inputRef.current?.focus()}];
  }, []);

  useHotkeys(storiesSearchHotkeys);

  const sectionedItems = useMemo(() => {
    const sections: StorySection[] = [];

    if (foundations.length > 0) {
      sections.push({
        key: 'foundations',
        label: 'Foundations',
        options: foundations,
      });
    }

    if (core.length > 0) {
      sections.push({
        key: 'components',
        label: 'Components',
        options: core,
      });
    }

    if (shared.length > 0) {
      sections.push({
        key: 'shared',
        label: 'Shared',
        options: shared,
      });
    }

    return sections;
  }, [foundations, core, shared]);

  return (
    <SearchComboBox
      label={t('Search stories')}
      menuTrigger="focus"
      inputRef={inputRef}
      defaultItems={sectionedItems}
    >
      {item => {
        if (isStorySection(item)) {
          return (
            <Section key={item.key} title={<SectionTitle>{item.label}</SectionTitle>}>
              {item.options.map(storyItem => (
                <Item
                  key={storyItem.filesystemPath}
                  textValue={storyItem.label}
                  {...({label: storyItem.label, hideCheck: true} as any)}
                />
              ))}
            </Section>
          );
        }

        return (
          <Item
            key={item.filesystemPath}
            textValue={item.label}
            {...({label: item.label, hideCheck: true} as any)}
          />
        );
      }}
    </SearchComboBox>
  );
}

function SearchInput(
  props: React.HTMLProps<HTMLInputElement> & React.RefAttributes<HTMLInputElement>
) {
  const {className: _0, style: _1, size: nativeSize, ...nativeProps} = props;

  return (
    <InputGroup style={{minHeight: 33, height: 33, width: 256}}>
      <InputGroup.LeadingItems disablePointerEvents>
        <IconSearch />
      </InputGroup.LeadingItems>
      <InputGroup.Input ref={props.ref} nativeSize={nativeSize} {...nativeProps} />
      <InputGroup.TrailingItems>
        <Badge type="internal">/</Badge>
      </InputGroup.TrailingItems>
    </InputGroup>
  );
}

type SearchComboBoxItem<T extends StoryTreeNode> = T | StorySection;

interface SearchComboBoxProps<T extends StoryTreeNode>
  extends Omit<AriaComboBoxProps<SearchComboBoxItem<T>>, 'children'> {
  children: CollectionChildren<SearchComboBoxItem<T>>;
  defaultItems: Array<SearchComboBoxItem<T>>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  description?: string | null;
  label?: string;
}

function filter(textValue: string, inputValue: string): boolean {
  const match = fzf(textValue, inputValue.toLowerCase(), false);
  return match.score > 0;
}

function SearchComboBox<T extends StoryTreeNode>(props: SearchComboBoxProps<T>) {
  const [inputValue, setInputValue] = useState('');
  const {inputRef} = props;
  const listBoxRef = useRef<HTMLUListElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const handleSelectionChange = useCallback(
    (key: Key | null) => {
      if (key) {
        navigate(`/stories?name=${key}`, {replace: true});
      }
    },
    [navigate]
  );

  const state = useComboBoxState({
    ...props,
    inputValue,
    onInputChange: setInputValue,
    defaultFilter: filter,
    shouldCloseOnBlur: false,
    allowsEmptyCollection: false,
    onSelectionChange: handleSelectionChange,
  });

  const {inputProps, listBoxProps, labelProps} = useSearchTokenCombobox<
    SearchComboBoxItem<T>
  >(
    {
      ...props,
      inputRef,
      listBoxRef,
      popoverRef,
    },
    state
  );

  return (
    <StorySearchContainer>
      <label {...labelProps} className="sr-only">
        {props.label}
      </label>
      <SearchInput ref={inputRef} placeholder={props.label} {...inputProps} />
      {state.isOpen && (
        <StyledOverlay placement="bottom-start" ref={popoverRef}>
          <ListBox
            listState={state}
            hasSearch={!!state.inputValue}
            hiddenOptions={new Set([])}
            keyDownHandler={() => false}
            overlayIsOpen={state.isOpen}
            size="sm"
            {...listBoxProps}
          >
            {props.children}
          </ListBox>
        </StyledOverlay>
      )}
    </StorySearchContainer>
  );
}

const StorySearchContainer = styled('div')`
  position: relative;
  width: 320px;
  flex-grow: 1;
  z-index: ${p => p.theme.zIndex.header};
  padding: ${space(1)};
  padding-right: 0;
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const StyledOverlay = styled(Overlay)`
  position: fixed;
  top: 48px;
  left: 108px;
  width: 320px;
  max-height: calc(100dvh - 128px);
  overflow-y: auto;

  /* Make section headers darker in this component */
  p[id][aria-hidden='true'] {
    color: ${p => p.theme.textColor};
  }
`;

const SectionTitle = styled('span')`
  color: ${p => p.theme.textColor};
  font-weight: 600;
  text-transform: uppercase;
`;
