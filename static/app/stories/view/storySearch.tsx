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
import {fzf} from 'sentry/utils/profiling/fzf/fzf';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

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
    product: productTree,
    typography: typographyTree,
    layout: layoutTree,
    shared: sharedTree,
    principles: principlesTree,
    patterns: patternsTree,
  } = useStoryBookFilesByCategory();
  const foundations = useMemo(
    () => foundationsTree.flatMap(tree => tree.flat()),
    [foundationsTree]
  );
  const core = useMemo(() => coreTree.flatMap(tree => tree.flat()), [coreTree]);
  const product = useMemo(() => productTree.flatMap(tree => tree.flat()), [productTree]);
  const typography = useMemo(
    () => typographyTree.flatMap(tree => tree.flat()),
    [typographyTree]
  );
  const principles = useMemo(
    () => principlesTree.flatMap(tree => tree.flat()),
    [principlesTree]
  );
  const layout = useMemo(() => layoutTree.flatMap(tree => tree.flat()), [layoutTree]);
  const shared = useMemo(() => sharedTree.flatMap(tree => tree.flat()), [sharedTree]);
  const patterns = useMemo(
    () => patternsTree.flatMap(tree => tree.flat()),
    [patternsTree]
  );

  useHotkeys([{match: '/', callback: () => inputRef.current?.focus()}]);

  const sectionedItems = useMemo(() => {
    const sections: StorySection[] = [];

    if (foundations.length > 0) {
      sections.push({
        key: 'foundations',
        label: 'Foundations',
        options: foundations,
      });
    }
    if (principles.length > 0) {
      sections.push({
        key: 'principles',
        label: 'Principles',
        options: principles,
      });
    }

    if (patterns.length > 0) {
      sections.push({
        key: 'patterns',
        label: 'Patterns',
        options: patterns,
      });
    }

    if (typography.length > 0) {
      sections.push({
        key: 'typography',
        label: 'Typography',
        options: typography,
      });
    }

    if (layout.length > 0) {
      sections.push({
        key: 'layout',
        label: 'Layout',
        options: layout,
      });
    }

    if (core.length > 0) {
      sections.push({
        key: 'components',
        label: 'Components',
        options: core,
      });
    }

    if (product.length > 0) {
      sections.push({
        key: 'product',
        label: 'Product',
        options: product,
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
  }, [foundations, core, product, layout, typography, shared, patterns, principles]);

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
        <Badge variant="internal">/</Badge>
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
