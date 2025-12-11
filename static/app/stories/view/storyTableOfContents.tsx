import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useLocation} from 'react-router-dom';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout/flex';
import {Text} from 'sentry/components/core/text';

type Entry = {
  ref: HTMLElement;
  title: string;
};

function toAlphaNumeric(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function getContentEntries(main: HTMLElement): Entry[] {
  const titles = Array.from(main.querySelectorAll('h2, h3, h4, h5, h6')).filter(
    title => title.closest('[data-test-id="storybook-demo"]') === null
  );
  const entries: Entry[] = [];

  for (const entry of Array.from(titles ?? [])) {
    // Ensure each title has an id we can link to
    if (!entry.id) {
      entry.id = toAlphaNumeric(entry.textContent ?? '');
    }
    entries.push({
      title: entry.textContent ?? '',
      ref: entry as HTMLElement,
    });
  }

  return entries;
}

function useStoryIndex(): Entry[] {
  const [entries, setEntries] = useState<Entry[]>([]);
  const location = useLocation();

  const hash = useMemo(() => location.hash.slice(1), [location.hash]);
  const scrolled = useRef<string>('');

  // automatically scroll to hash
  useEffect(() => {
    if (hash) {
      const entry = entries.find(e => e.ref.id === hash);
      if (entry && hash !== scrolled.current) {
        entry.ref.scrollIntoView();
        scrolled.current = hash;
      }
    }
  }, [hash, entries]);

  // populate entries
  useLayoutEffect(() => {
    const main = document.querySelector('main');
    if (main) {
      const initialEntries = getContentEntries(main);
      setEntries(initialEntries);
    }
  }, []);

  // update entries when content changes
  useLayoutEffect(() => {
    const observer = new MutationObserver(_mutations => {
      const main = document.querySelector('main');
      if (main) {
        const newEntries = getContentEntries(main);
        setEntries(newEntries);
      }
    });

    const main = document.querySelector('main');

    if (main) {
      observer.observe(document.body, {childList: true, subtree: true});
    }

    return () => observer.disconnect();
  }, [hash]);

  return entries;
}

function useActiveSection(entries: Entry[]): [string, (id: string) => void] {
  const [activeId, setActiveId] = useState<string>('');

  useLayoutEffect(() => {
    if (entries.length === 0) return void 0;

    const observer = new IntersectionObserver(
      intersectionEntries => {
        intersectionEntries
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
          .find(entry => {
            if (entry.isIntersecting) {
              setActiveId(entry.target.id);
              return true;
            }
            return false;
          });
      },
      {
        rootMargin: '0px 0px -35% 0px',
      }
    );

    entries.forEach(entry => observer.observe(entry.ref));

    return () => observer.disconnect();
  }, [entries]);

  return [activeId, setActiveId];
}

type NestedEntry = {
  children: NestedEntry[];
  entry: Entry;
};

const TAGNAME_ORDER = ['H6', 'H5', 'H4', 'H3', 'H2'];

function nestContentEntries(entries: Entry[]): NestedEntry[] {
  const nestedEntries: NestedEntry[] = [];

  if (entries.length <= 1) {
    return nestedEntries;
  }

  let parentEntry: NestedEntry | null = null;
  for (let i = 0; i < entries.length; i++) {
    const previousEntry = entries[i - 1];

    if (!previousEntry) {
      nestedEntries.push({
        entry: entries[i]!,
        children: [],
      });
      parentEntry = nestedEntries[nestedEntries.length - 1] ?? null;
      continue;
    }

    const entry = entries[i]!;
    const position = entry.ref.compareDocumentPosition(previousEntry.ref);

    const isAfter = !!(position & Node.DOCUMENT_POSITION_PRECEDING);
    const shouldNest =
      entry.ref.tagName === entries.at(0)?.ref.tagName
        ? false
        : TAGNAME_ORDER.indexOf(entry.ref.tagName) <=
          TAGNAME_ORDER.indexOf(entries[i - 1]?.ref.tagName ?? '');

    if (isAfter && shouldNest && parentEntry) {
      const parent: NestedEntry = {
        entry,
        children: [],
      };
      parentEntry.children.push(parent);
      continue;
    }

    nestedEntries.push({
      entry,
      children: [],
    });
    parentEntry = nestedEntries[nestedEntries.length - 1] ?? null;
  }

  return nestedEntries;
}

export function StoryTableOfContents() {
  const entries = useStoryIndex();
  const nestedEntries = useMemo(() => nestContentEntries(entries), [entries]);
  const [activeId, setActiveId] = useActiveSection(entries);

  if (nestedEntries.length === 0) return null;

  return (
    <StoryIndexContainer>
      <StoryIndexTitle>On this page</StoryIndexTitle>
      <StoryIndexList>
        {nestedEntries.map(entry => (
          <StoryContentsList
            key={entry.entry.ref.id}
            entry={entry}
            activeId={activeId}
            setActiveId={setActiveId}
          />
        ))}
      </StoryIndexList>
    </StoryIndexContainer>
  );
}

export function StoryTableOfContentsPlaceholder() {
  return <StoryIndexContainer aria-hidden="true" />;
}

function StoryContentsList({
  entry,
  activeId,
  setActiveId,
  isChild = false,
}: {
  activeId: string;
  entry: NestedEntry;
  setActiveId: (id: string) => void;
  isChild?: boolean;
}) {
  // Check if any children are active
  const hasActiveChild = entry.children.some(
    child =>
      child.entry.ref.id === activeId ||
      child.children.some(grandChild => grandChild.entry.ref.id === activeId)
  );

  const LinkComponent = isChild ? StyledChildLink : StyledLink;

  return (
    <Flex as="li" direction="column" aria-role="listitem">
      <LinkComponent
        href={`#${entry.entry.ref.id}`}
        isActive={entry.entry.ref.id === activeId}
        hasActiveChild={hasActiveChild}
        onClick={() => setActiveId(entry.entry.ref.id)}
      >
        <Text
          ellipsis
          variant={
            hasActiveChild
              ? 'primary'
              : entry.entry.ref.id === activeId
                ? 'accent'
                : 'muted'
          }
        >
          {entry.entry.title}
        </Text>
      </LinkComponent>
      {entry.children.length > 0 && (
        <StoryIndexList>
          {entry.children.map(child => (
            <StoryContentsList
              key={child.entry.ref.id}
              entry={child}
              activeId={activeId}
              setActiveId={setActiveId}
              isChild
            />
          ))}
        </StoryIndexList>
      )}
    </Flex>
  );
}

const StoryIndexContainer = styled('div')`
  display: none;
  position: sticky;
  top: 52px;
  margin-inline: 0 ${p => p.theme.space.xl};
  height: fit-content;
  padding: ${p => p.theme.space.xl};
  min-width: 0;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    display: block;
  }
`;

const StoryIndexTitle = styled('div')`
  line-height: 1.25;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.tokens.content.primary};
  height: 28px;
  display: flex;
  align-items: center;
`;

const StoryIndexList = styled('ul')`
  list-style: none;
  padding-left: ${p => p.theme.space.md};
  padding-right: ${p => p.theme.space.md};
  border-left: 1px solid ${p => p.theme.tokens.border.muted};
  margin: 0;
  margin-left: -${p => p.theme.space.xl};
  display: flex;
  flex-direction: column;

  ul {
    margin-left: -${p => p.theme.space.md};
    padding-left: ${p => p.theme.space.md};
    border-left: none;
  }
`;

const StyledLink = styled('a')<{hasActiveChild: boolean; isActive: boolean}>`
  display: block;
  text-decoration: none;
  padding: ${p => p.theme.space.md};
  transition: color 80ms ease-out;
  border-radius: ${p => p.theme.radius.md};
  position: relative;

  &:hover {
    background: ${p => p.theme.tokens.background.tertiary};
    color: ${p => p.theme.tokens.content.primary};
  }

  ${p =>
    p.isActive &&
    `
      &::before {
        content: '';
        display: block;
        position: absolute;
        left: -${p.theme.space.md};
        width: 4px;
        height: 16px;
        border-radius: 4px;
        transform: translateX(-2px);
        background: ${p.theme.tokens.graphics.accent};
      }
    `}
`;

const StyledChildLink = styled(StyledLink)<{isActive: boolean}>`
  margin-left: ${p => p.theme.space.xl};
  border-left: 0;
`;
