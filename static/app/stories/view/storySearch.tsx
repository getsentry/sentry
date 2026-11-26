import {useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {IconSearch} from '@sentry/icons/search';

import {HighlightText} from '@sentry/scraps/compactSelect';
import {useHotkeys, Hotkey} from '@sentry/scraps/hotkey';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {storyFrontmatterIndex, storyHeadingIndex} from 'sentry/stories/storyManifest';
import {fzf} from 'sentry/utils/search/fzf';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {StoryTreeNode} from './storyTree';
import {
  COMPONENT_SUBCATEGORY_CONFIG,
  isTreeSection,
  SECTION_CONFIG,
  SECTION_ORDER,
  useStoryHierarchy,
} from './storyTree';

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

function getStoryItems(nodes: StoryTreeNode[], orgSlug: string): SearchItem[] {
  return nodes.flatMap(node => {
    const pathname = normalizeUrl(
      `/organizations/${orgSlug}/scraps/${node.category}/${node.slug}/`
    );
    const page: SearchItem = {
      key: pathname,
      label: node.label,
      title: node.label,
      node,
      keywords: storyFrontmatterIndex[node.filesystemPath]?.keywords,
    };
    return [
      page,
      ...(storyHeadingIndex[node.filesystemPath] ?? []).map((heading): SearchItem => {
        const hash = `#${encodeURIComponent(heading.id)}`;
        return {
          key: pathname + hash,
          label: [node.label, ...heading.parents, heading.title].join(' › '),
          title: heading.title,
          node,
          hash,
          parents: heading.parents,
        };
      }),
    ];
  });
}

function searchItems(items: SearchItem[], query: string): SearchItem[] {
  const term = query.trim().toLowerCase();
  if (!term) {
    return items.filter(item => !item.hash);
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

export function StorySearch() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hierarchy = useStoryHierarchy();
  const {pathname, hash} = useLocation();
  const navigate = useNavigate();
  const {slug: orgSlug} = useOrganization();
  const [inputValue, setInputValue] = useState('');
  useHotkeys([{hotkey: '/', callback: () => inputRef.current?.focus()}]);

  const sections = useMemo(() => {
    const result: SearchSection[] = [];
    for (const section of SECTION_ORDER) {
      const data = hierarchy.get(section);
      if (!data?.stories.length) {
        continue;
      }

      const nodes =
        section === 'core'
          ? data.stories.flatMap(folder => folder.flat())
          : isTreeSection(section)
            ? data.stories.flatMap(tree => tree.flat())
            : data.stories;
      result.push({
        key: section,
        label: SECTION_CONFIG[section].label,
        options: getStoryItems(nodes, orgSlug),
      });
    }
    return result;
  }, [hierarchy, orgSlug]);

  const current = useMemo(() => {
    const items = sections.flatMap(section => section.options);
    const page = pathname.replace(/\/?$/, '/');
    return (
      items.find(item => item.key === page + hash) ??
      items.find(item => item.key === page)
    );
  }, [sections, pathname, hash]);

  const results = sections
    .map(section => ({...section, options: searchItems(section.options, inputValue)}))
    .filter(section => section.options.length > 0);
  if (inputValue.trim()) {
    // Put the section with the best match first.
    results.sort(({options: [a]}, {options: [b]}) => (a && b ? compareMatches(a, b) : 0));
  }

  const groups = results.map(section => ({
    label: (
      <Text size="xs" uppercase>
        {section.label}
      </Text>
    ),
    options: collapseBreadcrumbs(section.options).map(item => {
      const category =
        section.key === 'core'
          ? storyFrontmatterIndex[item.node.filesystemPath]?.category
          : undefined;
      const subcategory = category
        ? (COMPONENT_SUBCATEGORY_CONFIG as Record<string, {label: string} | undefined>)[
            category
          ]?.label
        : undefined;
      return {
        value: item.key,
        label: <SearchResultLabel item={item} query={inputValue} />,
        textValue: item.label,
        trailingItems: subcategory ? (
          <Text size="xs" variant="muted" ellipsis>
            {subcategory}
          </Text>
        ) : undefined,
      };
    }),
  }));

  // Select needs the current option for its label even when it is outside the results.
  const hiddenCurrent =
    current &&
    !groups.some(group => group.options.some(option => option.value === current.key))
      ? {
          value: current.key,
          label: <Text as="span">{current.label}</Text>,
          textValue: current.label,
          trailingItems: undefined,
        }
      : undefined;

  return (
    <StorySearchContainer>
      <Select
        aria-label={t('Search stories')}
        placeholder={t('Search stories')}
        size="sm"
        inputRef={inputRef}
        inputValue={inputValue}
        onInputChange={setInputValue}
        options={hiddenCurrent ? [...groups, hiddenCurrent] : groups}
        filterOption={
          hiddenCurrent ? option => option.value !== hiddenCurrent.value : null
        }
        value={current?.key ?? null}
        onChange={option => navigate(option.value)}
        noOptionsMessage={({inputValue: query}) =>
          query ? t('No stories match "%s"', query) : t('Type to search stories...')
        }
        openMenuOnFocus
        dropdownIndicator={null}
        leadingItems={<IconSearch size="sm" aria-hidden />}
        trailingItems={<Hotkey value="/" />}
        maxMenuHeight={320}
        minMenuHeight={groups.length > 0 ? 64 : undefined}
        styles={{menu: base => ({...base, width: 320})}}
      />
    </StorySearchContainer>
  );
}

const StorySearchContainer = styled('div')`
  position: relative;
  width: 320px;
  flex-grow: 1;
  z-index: ${p => p.theme.zIndex.header};
  margin-left: -${p => p.theme.space.xl};
`;
