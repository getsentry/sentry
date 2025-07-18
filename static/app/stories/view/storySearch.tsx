import type {Key} from 'react';
import {useMemo, useRef, useState} from 'react';
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
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
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
  const {stories: recentStories} = useRecentStories();
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

    if (recentStories.length > 0) {
      sections.push({
        key: 'recent',
        label: 'Recent',
        options: recentStories,
      });
    }

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
        label: 'Product',
        options: shared,
      });
    }

    return sections;
  }, [foundations, core, shared, recentStories]);

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

interface SearchComboBoxProps
  extends Omit<AriaComboBoxProps<SearchComboBoxItem<StoryTreeNode>>, 'children'> {
  children: CollectionChildren<SearchComboBoxItem<StoryTreeNode>>;
  defaultItems: Array<SearchComboBoxItem<StoryTreeNode>>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  description?: string | null;
  label?: string;
}

function filter(textValue: string, inputValue: string): boolean {
  const match = fzf(textValue, inputValue.toLowerCase(), false);
  return match.score > 0;
}

function SearchComboBox(props: SearchComboBoxProps) {
  const [inputValue, setInputValue] = useState('');
  const {inputRef} = props;
  const listBoxRef = useRef<HTMLUListElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const recentStories = useRecentStories();
  const navigate = useNavigate();
  const handleSelectionChange = (key: Key | null) => {
    if (!key) {
      return;
    }
    const node = getStoryTreeNodeFromKey(key, props);
    if (!node) {
      return;
    }
    const {state, ...to} = node.location;
    recentStories.add(node.filesystemPath);
    navigate(to, {replace: true, state});
  };
  const hiddenOptions = new Set<string>([]);
  const handleOpenChange = (isOpen: boolean) => {
    hiddenOptions.clear();
    if (!isOpen) {
      for (const category of props.defaultItems) {
        if (isStorySection(category) && category.key !== 'recent') {
          for (const node of category.options) {
            hiddenOptions.add(node.filesystemPath);
          }
        }
      }
    }
  };

  const state = useComboBoxState({
    ...props,
    inputValue,
    onInputChange: setInputValue,
    defaultFilter: filter,
    shouldCloseOnBlur: true,
    allowsEmptyCollection: false,
    onSelectionChange: handleSelectionChange,
    onOpenChange: handleOpenChange,
  });

  const {inputProps, listBoxProps, labelProps} = useSearchTokenCombobox<
    SearchComboBoxItem<StoryTreeNode>
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

const MAX_STORIES = 5;
function useRecentStories() {
  const [keys, setKeys] = useLocalStorageState<string[]>('stories:recent', []);
  const storiesByCategory = useStoryBookFilesByCategory();
  function add(key: string) {
    setKeys(current => Array.from(new Set([key, ...current.slice(0, MAX_STORIES - 1)])));
  }
  const stories = Object.values(storiesByCategory)
    .flat(1)
    .filter(value => keys.includes(value.filesystemPath));

  return {
    stories,
    add,
  };
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

function getStoryTreeNodeFromKey(
  key: Key,
  props: SearchComboBoxProps
): StoryTreeNode | undefined {
  for (const category of props.defaultItems) {
    if (isStorySection(category)) {
      for (const node of category.options) {
        const match = node.find(item => item.filesystemPath === key);
        if (match) {
          return match;
        }
      }
    }
  }
  return undefined;
}
