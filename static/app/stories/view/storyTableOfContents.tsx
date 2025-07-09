import {useLayoutEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import TextOverflow from 'sentry/components/textOverflow';
import {space} from 'sentry/styles/space';

type Entry = {
  ref: HTMLElement;
  title: string;
};

function toAlphaNumeric(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function getContentEntries(main: HTMLElement): Entry[] {
  const titles = main.querySelectorAll('h2, h3, h4, h5, h6');
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

  useLayoutEffect(() => {
    const observer = new MutationObserver(_mutations => {
      const main = document.querySelector('main');
      if (main) {
        setEntries(getContentEntries(main));
      }
    });

    const main = document.querySelector('main');

    if (main) {
      observer.observe(document.body, {childList: true, subtree: true});
    }

    // Fire this immediately to ensure entries are set on pageload
    window.requestAnimationFrame(() => {
      setEntries(getContentEntries(document.querySelector('main')!));
    });

    return () => observer.disconnect();
  }, []);

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

    entries.forEach(entry => {
      observer.observe(entry.ref);
    });

    return () => {
      observer.disconnect();
    };
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
    const hierarchy =
      TAGNAME_ORDER.indexOf(entry.ref.tagName) <=
      TAGNAME_ORDER.indexOf(entries[i - 1]?.ref.tagName ?? '');

    if (isAfter && hierarchy && parentEntry) {
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

  return (
    <StoryIndexContainer>
      <StoryIndexTitle>Contents</StoryIndexTitle>
      <StoryIndexListContainer>
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
      </StoryIndexListContainer>
    </StoryIndexContainer>
  );
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
  const isActive = entry.entry.ref.id === activeId;

  // Check if any children are active
  const hasActiveChild = entry.children.some(
    child =>
      child.entry.ref.id === activeId ||
      child.children.some(grandChild => grandChild.entry.ref.id === activeId)
  );

  // Apply active styling if this entry is active OR if any child is active
  const shouldShowActive = isActive || hasActiveChild;

  const LinkComponent = isChild ? StyledChildLink : StyledLink;

  return (
    <li>
      <LinkComponent
        href={`#${entry.entry.ref.id}`}
        isActive={shouldShowActive}
        onClick={() => setActiveId(entry.entry.ref.id)}
      >
        <TextOverflow>{entry.entry.title}</TextOverflow>
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
    </li>
  );
}

const StoryIndexContainer = styled('div')`
  display: none;
  position: sticky;
  top: 52px;
  margin-inline: 0 ${space(2)};
  height: fit-content;
  padding: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    display: block;
  }
`;

const StoryIndexListContainer = styled('div')`
  > ul {
    padding-left: 0;
    margin-top: ${space(1)};
  }

  > ul > li {
    padding-left: 0;
    margin-top: ${space(0.5)};

    > a {
      margin-bottom: ${space(0.25)};
    }
  }
`;

const StoryIndexTitle = styled('div')`
  line-height: 1.25;
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.headingColor};
  border-bottom: 2px solid ${p => p.theme.border};
  padding: 0 0 ${space(1)} 0;
  margin: 0 0 ${space(1)} 0;
`;

const StoryIndexList = styled('ul')`
  list-style: none;
  padding-left: ${space(1)};
  margin: 0;
  width: 200px;

  li {
    margin-bottom: ${space(0.5)};

    ul {
      margin-top: ${space(0.5)};
      margin-bottom: ${space(0.5)};

      li {
        margin-bottom: ${space(0.25)};
      }
    }
  }
`;

const StyledLink = styled('a')<{isActive: boolean}>`
  padding: ${space(0.5)} ${space(0.75)};
  display: block;
  color: ${p => p.theme.textColor};
  text-decoration: none;
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.4;
  transition: all 0.15s ease;
  position: relative;

  &:hover {
    background: ${p => p.theme.hover};
    color: ${p => p.theme.textColor};
  }

  ${p =>
    p.isActive &&
    `
      color: ${p.theme.textColor};
      font-weight: ${p.theme.fontWeight.bold};
    `}
`;

const StyledChildLink = styled('a')<{isActive: boolean}>`
  font-size: ${p => p.theme.fontSize.sm};
  padding: ${space(0.25)} ${space(0.5)};
  margin-left: ${space(0.5)};
  border-left: 2px solid transparent;
  display: block;
  color: ${p => p.theme.textColor};
  text-decoration: none;
  line-height: 1.4;
  transition: all 0.15s ease;

  &:hover {
    background: ${p => p.theme.hover};
    color: ${p => p.theme.textColor};
    border-left-color: ${p => p.theme.activeText};
  }

  ${p =>
    p.isActive &&
    `
      border-left-color: ${p.theme.activeText};
    `}
`;
