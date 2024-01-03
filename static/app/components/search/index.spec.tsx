import Fuse from 'fuse.js';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Search, SearchProps} from 'sentry/components/search';
import {ChildProps, Result, ResultItem} from 'sentry/components/search/sources/types';

function makeSearchResultsMock(items?: ResultItem[], threshold?: number) {
  return function SearchResultsMock({
    loading,
    children,
    query,
  }: {
    children: (props: ChildProps) => React.ReactElement | null;
    loading: boolean;
    query: string;
  }): React.ReactElement<any, any> | null {
    const searchableItems: ResultItem[] = items ?? [
      {
        resultType: 'integration',
        sourceType: 'organization',
        title: 'Vandelay Industries - Import',
        model: {slug: 'vdl-imp'},
      },
      {
        resultType: 'integration',
        model: {slug: 'vdl-exp'},
        sourceType: 'organization',
        title: 'Vandelay Industries - Export',
      },
    ];
    const results = new Fuse(searchableItems, {
      keys: ['title'],
      includeMatches: true,
      includeScore: true,
      threshold: threshold ?? 0.3,
    })
      .search(query)
      .map(item => {
        const result: Result = {
          item: item.item,
          score: item.score,
          matches: item.matches,
          refIndex: 0,
        };
        return result;
      });

    return children({
      isLoading: loading,
      results,
    });
  } as React.ComponentType;
}
const makeSearchProps = (partial: Partial<SearchProps> = {}): SearchProps => {
  return {
    renderInput: ({getInputProps}) => {
      return <input {...getInputProps({placeholder: 'Search Input'})} />;
    },
    sources: [makeSearchResultsMock()],
    caseSensitive: false,
    minSearch: 0,
    ...partial,
  } as SearchProps;
};

describe('Search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search results from source', async () => {
    jest.useFakeTimers();
    render(<Search {...makeSearchProps()} />, {
      context: RouterContextFixture(),
    });

    await userEvent.click(screen.getByPlaceholderText('Search Input'), {delay: null});
    await userEvent.keyboard('Export', {delay: null});

    jest.advanceTimersByTime(500);
    jest.useRealTimers();

    expect(
      screen.getByText(textWithMarkupMatcher(/Vandelay Industries - Export/))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/Vandelay Industries - Import/))
    ).not.toBeInTheDocument();
  });

  it('navigates to a route when item has to prop', async () => {
    render(
      <Search
        {...makeSearchProps({
          sources: [
            makeSearchResultsMock([
              {
                resultType: 'integration',
                sourceType: 'organization',
                title: 'Vandelay Industries - Import',
                to: 'https://vandelayindustries.io/import',
                model: {slug: 'vdl-imp'},
              },
            ]),
          ],
        })}
      />,
      {
        context: RouterContextFixture(),
      }
    );

    const opener = {opener: 'Sentry.io', location: {href: null}};

    // @ts-expect-error this is a partial mock of the window object
    const windowSpy = jest.spyOn(window, 'open').mockReturnValue(opener);

    await userEvent.click(screen.getByPlaceholderText('Search Input'));
    await userEvent.keyboard('Import');

    await userEvent.click(
      screen.getByText(textWithMarkupMatcher(/Vandelay Industries - Import/))
    );

    expect(windowSpy).toHaveBeenCalledTimes(1);
    expect(opener.opener).not.toBe('Sentry.io');
    expect(opener.location.href).toBe('https://vandelayindustries.io/import');
  });

  it('calls item action when it is a function', async () => {
    render(
      <Search
        {...makeSearchProps({
          sources: [
            makeSearchResultsMock([
              {
                resultType: 'integration',
                sourceType: 'organization',
                title: 'Vandelay Industries - Import',
                to: 'https://vandelayindustries.io/import',
                model: {slug: 'vdl-imp'},
              },
            ]),
          ],
        })}
      />,
      {
        context: RouterContextFixture(),
      }
    );

    const opener = {opener: 'Sentry.io', location: {href: null}};

    // @ts-expect-error this is a partial mock of the window object
    const windowSpy = jest.spyOn(window, 'open').mockReturnValue(opener);

    await userEvent.click(screen.getByPlaceholderText('Search Input'));
    await userEvent.keyboard('Import');

    await userEvent.click(
      screen.getByText(textWithMarkupMatcher(/Vandelay Industries - Import/))
    );

    expect(windowSpy).toHaveBeenCalledTimes(1);
    expect(opener.opener).not.toBe('Sentry.io');
    expect(opener.location.href).toBe('https://vandelayindustries.io/import');
  });
  it('renders max search results', async () => {
    const results: ResultItem[] = new Array(10).fill(0).map((_, i) => ({
      resultType: 'integration',
      sourceType: 'organization',
      title: `${i} Vandelay Industries - Import`,
      to: 'https://vandelayindustries.io/import',
      model: {slug: 'vdl-imp'},
    }));

    render(
      <Search
        {...makeSearchProps({
          maxResults: 5,
          sources: [makeSearchResultsMock(results)],
        })}
      />,
      {
        context: RouterContextFixture(),
      }
    );

    await userEvent.click(screen.getByPlaceholderText('Search Input'));
    await userEvent.keyboard('Vandelay');

    expect(await screen.findAllByText(/Vandelay/)).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(
        screen.getByText(textWithMarkupMatcher(`${i} Vandelay Industries - Import`))
      ).toBeInTheDocument();
    }
  });
  it('shows no search result', async () => {
    render(
      <Search
        {...makeSearchProps({
          maxResults: 5,
          sources: [makeSearchResultsMock([])],
        })}
      />,
      {
        context: RouterContextFixture(),
      }
    );

    await userEvent.click(screen.getByPlaceholderText('Search Input'));
    await userEvent.keyboard('Vandelay');

    expect(screen.getByText(/No results/)).toBeInTheDocument();
  });
});
