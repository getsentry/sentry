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
import {
  SECTION_CONFIG,
  SECTION_ORDER,
  useStoryHierarchy,
} from 'sentry/stories/view/storyTree';
import {fzf} from 'sentry/utils/profiling/fzf/fzf';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

interface SearchSection {
  key: string;
  label: string;
  options: StoryTreeNode[];
}

function isSearchSection(item: StoryTreeNode | SearchSection): item is SearchSection {
  return 'options' in item;
}

export function StorySearch() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hierarchy = useStoryHierarchy();
  useHotkeys([{match: '/', callback: () => inputRef.current?.focus()}]);

  const sectionedItems = useMemo(() => {
    const sections: SearchSection[] = [];

    for (const section of SECTION_ORDER) {
      const data = hierarchy.get(section);
      if (!data) {
        continue;
      }

      // For components section, flatten all subcategories into component groups
      if (section === 'core') {
        for (const subcategoryFolder of data.stories) {
          const nodes = Object.values(subcategoryFolder.children);
          if (nodes.length) {
            sections.push({
              key: subcategoryFolder.path,
              label: subcategoryFolder.name,
              options: nodes,
            });
          }
        }
      } else if (data.stories.length > 0) {
        sections.push({
          key: section,
          label: SECTION_CONFIG[section].label,
          options: data.stories,
        });
      }
    }

    return sections;
  }, [hierarchy]);

  return (
    <SearchComboBox
      label={t('Search stories')}
      menuTrigger="focus"
      inputRef={inputRef}
      defaultItems={sectionedItems}
    >
      {item => {
        if (isSearchSection(item)) {
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
        <Badge variant="internal">/</Badge>
      </InputGroup.TrailingItems>
    </InputGroup>
  );
}

type SearchComboBoxItem<T extends StoryTreeNode> = T | SearchSection;

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
  const navigate = useNavigate();

  const organization = useOrganization();
  const handleSelectionChange = (key: Key | null) => {
    if (!key) {
      return;
    }
    const node = getStoryTreeNodeFromKey(key, props);
    if (!node) {
      return;
    }
    navigate({
      pathname: normalizeUrl(
        `/organizations/${organization.slug}/stories/${node.category}/${node.slug}/`
      ),
    });
  };

  const state = useComboBoxState({
    ...props,
    inputValue,
    onInputChange: setInputValue,
    defaultFilter: filter,
    shouldCloseOnBlur: true,
    allowsEmptyCollection: false,
    onSelectionChange: handleSelectionChange,
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
  padding: ${p => p.theme.space.md};
  padding-right: 0;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  margin-left: -${p => p.theme.space['2xl']};
`;

const StyledOverlay = styled(Overlay)`
  position: fixed;
  top: 48px;
  left: 256px;
  width: 320px;
  max-height: calc(100dvh - 128px);
  overflow-y: auto;

  /* Make section headers darker in this component */
  p[id][aria-hidden='true'] {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const SectionTitle = styled('span')`
  color: ${p => p.theme.tokens.content.primary};
  font-weight: 600;
  text-transform: uppercase;
`;

function getStoryTreeNodeFromKey(
  key: Key,
  props: SearchComboBoxProps
): StoryTreeNode | undefined {
  for (const category of props.defaultItems) {
    if (isSearchSection(category)) {
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
