import {useEffect} from 'react';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  CommandPaletteProvider,
  useCommandPaletteActions as useRegisteredActions,
  useCommandPaletteQueryState,
} from 'sentry/components/commandPalette/context';
import {useDocsSearchActions} from 'sentry/components/commandPalette/useDocsSearchActions';

const mockQuery = jest.fn();

jest.mock('@sentry-internal/global-search', () => ({
  SentryGlobalSearch: jest.fn().mockImplementation(() => ({
    query: mockQuery,
  })),
}));

function SetQuery({query}: {query: string}) {
  const {setQuery} = useCommandPaletteQueryState();
  useEffect(() => setQuery(query), [query, setQuery]);
  return null;
}

function DocsSearchHarness({query}: {query: string}) {
  useDocsSearchActions();
  const actions = useRegisteredActions();

  return (
    <ul>
      <SetQuery query={query} />
      {actions.map(action => (
        <li key={action.key} data-type={action.type}>
          {action.display.label}
        </li>
      ))}
    </ul>
  );
}

function renderWithProvider(query: string) {
  return render(
    <CommandPaletteProvider>
      <DocsSearchHarness query={query} />
    </CommandPaletteProvider>
  );
}

function makeHit(title: string, url: string, context1?: string) {
  return {
    id: title,
    site: 'docs',
    title,
    text: '',
    url,
    context: {context1: context1 ?? ''},
  };
}

describe('useDocsSearchActions', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('registers actions from search results', async () => {
    mockQuery.mockResolvedValue([
      {
        site: 'docs',
        name: 'Documentation',
        hits: [
          makeHit('Getting Started', 'https://docs.sentry.io/getting-started/', 'Docs'),
          makeHit('Configuration', 'https://docs.sentry.io/configuration/', 'Docs'),
        ],
      },
    ]);

    renderWithProvider('getting started');

    await waitFor(() => {
      expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
    });

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Getting Started');
    expect(items[1]).toHaveTextContent('Configuration');
    expect(items[0]).toHaveAttribute('data-type', 'callback');
  });

  it('strips HTML from labels', async () => {
    mockQuery.mockResolvedValue([
      {
        site: 'docs',
        name: 'Documentation',
        hits: [makeHit('<mark>MCP</mark> Dashboard', 'https://docs.sentry.io/mcp/')],
      },
    ]);

    renderWithProvider('mcp');

    await waitFor(() => {
      expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
    });

    // The plain text label should have HTML stripped
    expect(screen.getByRole('listitem')).toHaveTextContent('MCP Dashboard');
  });

  it('does not search when query is shorter than 3 characters', async () => {
    renderWithProvider('mc');

    // Give debounce time to settle
    await waitFor(() => {
      expect(mockQuery).not.toHaveBeenCalled();
    });

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('does not search when query is empty', async () => {
    renderWithProvider('');

    await waitFor(() => {
      expect(mockQuery).not.toHaveBeenCalled();
    });

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('limits results to 5', async () => {
    mockQuery.mockResolvedValue([
      {
        site: 'docs',
        name: 'Documentation',
        hits: Array.from({length: 10}, (_, i) =>
          makeHit(`Result ${i}`, `https://docs.sentry.io/${i}/`)
        ),
      },
    ]);

    renderWithProvider('result');

    await waitFor(() => {
      expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('clears actions when query is cleared', async () => {
    mockQuery.mockResolvedValue([
      {
        site: 'docs',
        name: 'Documentation',
        hits: [makeHit('Test Page', 'https://docs.sentry.io/test/')],
      },
    ]);

    const {rerender} = renderWithProvider('test query');

    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });

    rerender(
      <CommandPaletteProvider>
        <DocsSearchHarness query="" />
      </CommandPaletteProvider>
    );

    await waitFor(() => {
      expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    });
  });
});
