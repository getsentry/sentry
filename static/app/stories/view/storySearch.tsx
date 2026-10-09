import type {Key} from 'react';
import {useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {type AriaComboBoxProps} from '@react-aria/combobox';
import {Item, Section} from '@react-stately/collections';
import {useComboBoxState} from '@react-stately/combobox';
import type {CollectionChildren} from '@react-types/shared';
import {IconSearch} from '@sentry/icons/search';

import {HighlightText, ListBox} from '@sentry/scraps/compactSelect';
import {useHotkeys, Hotkey} from '@sentry/scraps/hotkey';
import {InputGroup} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Overlay} from 'sentry/components/overlay';
import {useSearchTokenCombobox} from 'sentry/components/searchQueryBuilder/tokens/useSearchTokenCombobox';
import {t} from 'sentry/locale';
import {
  storyFrontmatterIndex,
  storyHeadingIndex,
} from 'sentry/stories/storyManifest.generated';
import type {StoryTreeNode} from 'sentry/stories/view/storyTree';
import {
  COMPONENT_SUBCATEGORY_CONFIG,
  SECTION_CONFIG,
  SECTION_ORDER,
  useStoryHierarchy,
} from 'sentry/stories/view/storyTree';
import {fzf} from 'sentry/utils/search/fzf';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

interface SearchItem {
  key: string;
  label: string;
  node: StoryTreeNode;
  title: string;
  /** Visible breadcrumb before the title, with `…` standing in for hidden parents. */
  crumbs?: string[];
  hash?: string;
  keywords?: string[];
  match?: {rank: number; score: number};
  parents?: string[];
}

interface SearchSection {
  key: string;
  label: string;
  options: SearchItem[];
}

function matchScore(item: SearchItem, term: string) {
  return Math.max(
    ...[item.label, ...(item.keywords ?? [])].map(text => fzf(text, term, false).score)
  );
}

function searchItems(nodes: StoryTreeNode[], query: string): SearchItem[] {
  const items = nodes.flatMap(node => {
    const page: SearchItem = {
      key: node.filesystemPath,
      label: node.label,
      title: node.label,
      node,
      keywords: storyFrontmatterIndex[node.filesystemPath]?.keywords,
    };
    // Keep the empty-query menu compact. Sections are discovery results, not
    // additional pages in the navigation tree.
    if (!query.trim()) {
      return [page];
    }
    return [
      page,
      ...(storyHeadingIndex[node.filesystemPath] ?? []).map((heading): SearchItem => ({
        key: `${node.filesystemPath}#${heading.id}`,
        label: [node.label, ...heading.parents, heading.title].join(' › '),
        title: heading.title,
        node,
        hash: `#${encodeURIComponent(heading.id)}`,
        parents: heading.parents,
      })),
    ];
  });
  const term = query.trim().toLowerCase();
  if (!term) {
    return items;
  }
  return items
    .map(item => {
      const names = [item.title, ...(item.keywords ?? [])].map(name =>
        name.toLowerCase()
      );
      const rank = names.includes(term)
        ? 2
        : names.some(name => name.startsWith(term))
          ? 1
          : 0;
      return {...item, match: {rank, score: matchScore(item, term)}};
    })
    .filter(item => item.match.score > 0)
    .sort(compareMatches);
}

function compareMatches(a: SearchItem, b: SearchItem) {
  return (
    (b.match?.rank ?? 0) - (a.match?.rank ?? 0) ||
    Number(!!a.hash) - Number(!!b.hash) ||
    (b.match?.score ?? 0) - (a.match?.score ?? 0)
  );
}

function visibleCrumbs(item: SearchItem, shownParents: number) {
  if (!item.hash) {
    return [];
  }
  const parents = item.parents ?? [];
  const hidden = parents.length - shownParents;
  return [item.node.label, ...(hidden > 0 ? ['…'] : []), ...parents.slice(hidden)];
}

/**
 * Full breadcrumbs repeat the page and parent headings on every result, so
 * collapse them to `Page › … › Title`. Results that would then look identical
 * (e.g. an Accessibility section under each of two components) reveal their
 * nearest parents until they can be told apart.
 */
function collapseBreadcrumbs(items: SearchItem[]): SearchItem[] {
  const shown = new Map(items.map(item => [item, 0]));
  const display = (item: SearchItem) =>
    [...visibleCrumbs(item, shown.get(item) ?? 0), item.title].join(' › ');

  let expanded = true;
  while (expanded) {
    expanded = false;
    const groups = Map.groupBy(items, display);
    for (const group of groups.values()) {
      if (group.length < 2) {
        continue;
      }
      for (const item of group) {
        const count = shown.get(item) ?? 0;
        if (count < (item.parents?.length ?? 0)) {
          shown.set(item, count + 1);
          expanded = true;
        }
      }
    }
  }
  return items.map(item => ({
    ...item,
    crumbs: visibleCrumbs(item, shown.get(item) ?? 0),
  }));
}

function SearchResultLabel({item, query}: {item: SearchItem; query: string}) {
  const crumbs = item.crumbs ?? [];
  // The accessible name keeps the full path; the visible label is collapsed.
  return (
    <Text as="span" aria-label={item.label}>
      <Text as="span" aria-hidden="true">
        {crumbs.length > 0 && (
          <Text as="span" variant="muted">
            {crumbs.join(' › ')} ›{' '}
          </Text>
        )}
        <HighlightText text={item.title} query={query} />
      </Text>
    </Text>
  );
}

function isSearchSection(item: SearchItem | SearchSection): item is SearchSection {
  return 'options' in item;
}

export function StorySearch() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hierarchy = useStoryHierarchy();
  const [inputValue, setInputValue] = useState('');
  useHotkeys([{match: '/', callback: () => inputRef.current?.focus()}]);

  const sectionedItems = useMemo(() => {
    const sections: SearchSection[] = [];

    for (const section of SECTION_ORDER) {
      const data = hierarchy.get(section);
      if (!data) {
        continue;
      }

      // For components section, consolidate all subcategories into a single section
      if (section === 'core') {
        const allCoreNodes = data.stories.flatMap(subcategoryFolder =>
          subcategoryFolder.flat()
        );

        if (allCoreNodes.length > 0) {
          sections.push({
            key: section,
            label: SECTION_CONFIG[section].label,
            options: searchItems(allCoreNodes, inputValue),
          });
        }
      } else if (section === 'product' && data.stories.length > 0) {
        const flattenedStories = data.stories.flatMap(tree => tree.flat());
        sections.push({
          key: section,
          label: SECTION_CONFIG[section].label,
          options: searchItems(flattenedStories, inputValue),
        });
      } else if (data.stories.length > 0) {
        // Other sections (principles, patterns) don't need flattening
        sections.push({
          key: section,
          label: SECTION_CONFIG[section].label,
          options: searchItems(data.stories, inputValue),
        });
      }
    }

    // A page's results always share a section, so look-alike results can only
    // collide within one.
    const results = sections
      .filter(section => section.options.length > 0)
      .map(section => ({...section, options: collapseBreadcrumbs(section.options)}));
    // Section headings make weak matches common in the sections
    // listed first, so lead with the section that holds the best match.
    return inputValue.trim()
      ? results.sort(({options: [a]}, {options: [b]}) =>
          a && b ? compareMatches(a, b) : 0
        )
      : results;
  }, [hierarchy, inputValue]);

  return (
    <SearchComboBox
      label={t('Search stories')}
      menuTrigger="focus"
      inputRef={inputRef}
      items={sectionedItems}
      inputValue={inputValue}
      onInputChange={setInputValue}
    >
      {item => {
        if (isSearchSection(item)) {
          return (
            <Section
              key={item.key}
              title={
                <Text size="xs" uppercase>
                  {item.label}
                </Text>
              }
            >
              {item.options.map(storyItem => {
                const meta = storyFrontmatterIndex[storyItem.node.filesystemPath];
                const subcategoryKey = item.key === 'core' ? meta?.category : undefined;
                const subcategoryLabel = subcategoryKey
                  ? (
                      COMPONENT_SUBCATEGORY_CONFIG as Record<
                        string,
                        {label: string} | undefined
                      >
                    )[subcategoryKey]?.label
                  : undefined;

                return (
                  <Item
                    key={storyItem.key}
                    textValue={storyItem.label}
                    {...({
                      label: <SearchResultLabel item={storyItem} query={inputValue} />,
                      trailingItems: subcategoryLabel ? (
                        <Text size="xs" variant="muted" ellipsis>
                          {subcategoryLabel}
                        </Text>
                      ) : undefined,
                      hideCheck: true,
                    } as any)}
                  />
                );
              })}
            </Section>
          );
        }

        return (
          <Item
            key={item.key}
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
    <InputGroup>
      <InputGroup.LeadingItems disablePointerEvents>
        <IconSearch />
      </InputGroup.LeadingItems>
      {/* oxlint-disable-next-line react/refs */}
      <InputGroup.Input ref={props.ref} nativeSize={nativeSize} {...nativeProps} />
      <InputGroup.TrailingItems>
        <Hotkey value="/" />
      </InputGroup.TrailingItems>
    </InputGroup>
  );
}

type SearchComboBoxItem = SearchItem | SearchSection;

interface SearchComboBoxProps extends Omit<
  AriaComboBoxProps<SearchComboBoxItem>,
  'children'
> {
  children: CollectionChildren<SearchComboBoxItem>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  inputValue: string;
  items: SearchSection[];
  description?: string | null;
  label?: string;
}

function SearchComboBox(props: SearchComboBoxProps) {
  const {inputRef, inputValue} = props;
  const listBoxRef = useRef<HTMLUListElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const organization = useOrganization();
  const handleValueChange = (key: Key | null) => {
    if (!key) {
      return;
    }
    const item = props.items
      .flatMap(section => section.options)
      .find(option => option.key === key);
    if (!item) {
      return;
    }
    navigate({
      pathname: normalizeUrl(
        `/organizations/${organization.slug}/scraps/${item.node.category}/${item.node.slug}/`
      ),
      hash: item.hash ?? '',
    });
  };

  const state = useComboBoxState({
    ...props,
    shouldCloseOnBlur: true,
    allowsEmptyCollection: true,
    onChange: handleValueChange,
  });

  const {inputProps, listBoxProps, labelProps} =
    useSearchTokenCombobox<SearchComboBoxItem>(
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
          {state.collection.size === 0 ? (
            inputValue.length === 0 ? (
              <SearchEmpty />
            ) : (
              <SearchNotFound inputValue={inputValue} />
            )
          ) : (
            <ListBox
              size="sm"
              virtualized
              listState={state}
              hasSearch={!!state.inputValue}
              overlayIsOpen={state.isOpen}
              {...listBoxProps}
              className="story-search-results"
            >
              {props.children}
            </ListBox>
          )}
        </StyledOverlay>
      )}
    </StorySearchContainer>
  );
}

function SearchEmpty() {
  return (
    <Flex align="center" justify="start" padding="lg">
      <Text variant="muted" size="sm">
        {t('Type to search stories...')}
      </Text>
    </Flex>
  );
}

function SearchNotFound({inputValue}: {inputValue: string}) {
  return (
    <Flex align="center" justify="start" padding="lg">
      <Text variant="muted" size="sm">
        {t('No stories match "%s"', inputValue)}
      </Text>
    </Flex>
  );
}

const StorySearchContainer = styled('div')`
  position: relative;
  width: 320px;
  flex-grow: 1;
  z-index: ${p => p.theme.zIndex.header};
  margin-left: -${p => p.theme.space.xl};
`;

const StyledOverlay = styled(Overlay)`
  position: absolute;
  top: 100%;
  left: 0;
  width: 320px;

  /* Make section headers darker in this component */
  p[id][aria-hidden='true'] {
    color: ${p => p.theme.tokens.content.primary};
  }

  .story-search-results {
    max-height: 320px;
    min-height: 64px;
    padding-block-end: calc(${p => p.theme.space.md} + 1px);
  }
`;
