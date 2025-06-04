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
      <StoryIndexTitle>Contents</StoryIndexTitle>
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
`;

const StoryIndexListContainer = styled('div')`
  > ul {
    padding-left: 0;
    margin-top: ${space(1)};
  }

  > ul > li {
    padding-left: 0;
    margin-top: ${space(1)};

    > a {
      margin-bottom: ${space(0.5)};
    }
  }
`;

const StoryIndexTitle = styled('div')`
  border-bottom: 1px solid ${p => p.theme.border};
  padding: ${space(0.5)} 0 ${space(1)} 0;
  margin-bottom: ${space(1)};
`;

const StoryIndexList = styled('ul')`
  list-style: none;
  padding-left: ${space(0.75)};
  margin: 0;
  width: 160px;

  li {
    &:hover {
      background: ${p => p.theme.backgroundSecondary};
    }

    a {
      padding: ${space(0.25)} 0;
      display: block;
      color: ${p => p.theme.textColor};
      text-decoration: none;
    }
  }
`;
