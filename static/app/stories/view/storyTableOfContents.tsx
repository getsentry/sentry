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

  return (
    <StoryIndexContainer>
      <StoryIndexTitle>On this page</StoryIndexTitle>
      <StoryIndexListContainer>
        <StoryIndexList>
          {nestedEntries.map(entry => (
            <StoryContentsList key={entry.entry.ref.id} entry={entry} />
          ))}
        </StoryIndexList>
      </StoryIndexListContainer>
    </StoryIndexContainer>
  );
}

function StoryContentsList({entry}: {entry: NestedEntry}) {
  return (
    <li>
      <a href={`#${entry.entry.ref.id}`}>
        <TextOverflow>{entry.entry.title}</TextOverflow>
      </a>
      {entry.children.length > 0 && (
        <StoryIndexList>
          {entry.children.map(child => (
            <StoryContentsList key={child.entry.ref.id} entry={child} />
          ))}
        </StoryIndexList>
      )}
    </li>
  );
}

const StoryIndexContainer = styled('div')`
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    display: none;
  }
  position: sticky;
`;

const StoryIndexListContainer = styled('div')`
  color: ${p => p.theme.tokens.content.muted};
  a {
    color: inherit;
    padding: ${space(1)};
  }

  > ul {
    margin-top: ${space(1)};
    padding-left: ${space(0.75)};
    border-left: 1px solid ${p => p.theme.tokens.border.primary};
  }

  > ul > li {
    padding-left: 0;
    margin-top: ${space(1)};
  }
`;

const StoryIndexTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
  padding: ${space(0.5)} 0 ${space(1)} ${space(0.75)};
  margin-bottom: ${space(1)};
  color: ${p => p.theme.tokens.content.primary};
`;

const StoryIndexList = styled('ul')`
  list-style: none;
  padding-left: 0;
  margin: 0;
  width: 160px;

  li {
    a {
      display: block;
      color: ${p => p.theme.tokens.content.muted};
      text-decoration: none;
      border-radius: ${p => p.theme.borderRadius};

      &:hover {
        background: ${p => p.theme.tokens.background.secondary};
      }
      &:active {
        color: ${p => p.theme.tokens.content.accent};
      }
      &:target {
        color: ${p => p.theme.tokens.content.accent};
      }
    }
  }
`;
