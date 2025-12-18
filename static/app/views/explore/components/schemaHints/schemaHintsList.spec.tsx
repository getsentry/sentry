import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {TagCollection} from 'sentry/types/group';
import {AggregationKey, FieldKind} from 'sentry/utils/fields';
import SchemaHintsList from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {useQueryParamsQuery} from 'sentry/views/explore/queryParams/context';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

const mockStringTags: TagCollection = {
  stringTag1: {key: 'stringTag1', kind: FieldKind.TAG, name: 'stringTag1'},
  stringTag2: {key: 'stringTag2', kind: FieldKind.TAG, name: 'stringTag2'},
};

const mockNumberTags: TagCollection = {
  numberTag1: {key: 'numberTag1', kind: FieldKind.MEASUREMENT, name: 'numberTag1'},
  numberTag2: {key: 'numberTag2', kind: FieldKind.MEASUREMENT, name: 'numberTag2'},
};

const mockCustomTags: TagCollection = {
  customTag: {key: 'customTag', kind: FieldKind.TAG, name: 'customTag'},
};

const mockDispatch = jest.fn();

// Add mock for useSearchQueryBuilder
jest.mock('sentry/components/searchQueryBuilder/context', () => ({
  useSearchQueryBuilder: () => ({
    query: '',
    getTagValues: () => Promise.resolve(['tagValue1', 'tagValue2']),
    dispatch: mockDispatch,
    wrapperRef: {current: null},
  }),
  SearchQueryBuilderProvider: ({children}: {children: React.ReactNode}) => children,
}));

function Subject(
  props: Omit<
    Parameters<typeof SchemaHintsList>[0],
    'exploreQuery' | 'setPageParams' | 'tableColumns'
  >
) {
  function Content() {
    const query = useQueryParamsQuery();
    return <SchemaHintsList {...props} exploreQuery={query} />;
  }
  return (
    <SpansQueryParamsProvider>
      <Content />
    </SpansQueryParamsProvider>
  );
}

// Mock getBoundingClientRect for container
jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
  this: HTMLElement
) {
  // Mock individual hint items
  if (this.hasAttribute('data-type')) {
    return {
      width: 200,
      right: 200,
      left: 0,
      top: 0,
      bottom: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    };
  }
  return {
    width: 1000,
    right: 1000,
    left: 0,
    top: 0,
    bottom: 100,
    height: 100,
    x: 0,
    y: 0,
    toJSON: () => {},
  };
});

describe('SchemaHintsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render', () => {
    render(
      <Subject
        stringTags={mockStringTags}
        numberTags={mockNumberTags}
        supportedAggregates={[AggregationKey.COUNT]}
      />
    );

    const container = screen.getByLabelText('Schema Hints List');
    const withinContainer = within(container);
    expect(withinContainer.getByText('stringTag1')).toBeInTheDocument();
    expect(withinContainer.getByText('stringTag2')).toBeInTheDocument();
    expect(withinContainer.getAllByText('is')).toHaveLength(2);
    expect(withinContainer.getByText('numberTag1')).toBeInTheDocument();
    expect(withinContainer.getByText('numberTag2')).toBeInTheDocument();
    expect(withinContainer.getByText('count(...)')).toBeInTheDocument();
    expect(withinContainer.getAllByText('>')).toHaveLength(3);
    expect(withinContainer.getAllByText('...')).toHaveLength(5);
    expect(withinContainer.getByText('See full list')).toBeInTheDocument();
  });

  it('should call dispatch with correct parameters when hint is clicked', async () => {
    render(
      <Subject
        stringTags={mockStringTags}
        numberTags={mockNumberTags}
        supportedAggregates={[]}
      />
    );

    const stringTag1Hint = screen.getByText('stringTag1');
    await userEvent.click(stringTag1Hint);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_QUERY',
      query: 'stringTag1:""',
      focusOverride: {
        itemKey: 'filter:0',
        part: 'value',
      },
      shouldCommitQuery: false,
    });
  });

  it('should render loading indicator when isLoading is true', () => {
    render(
      <Subject stringTags={{}} numberTags={{}} supportedAggregates={[]} isLoading />
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('should open drawer when see full list is clicked', async () => {
    render(
      <Subject
        stringTags={mockStringTags}
        numberTags={mockNumberTags}
        supportedAggregates={[]}
      />
    );

    const seeFullList = screen.getByText('See full list');
    await userEvent.click(seeFullList);

    expect(screen.getByLabelText('Schema Hints Drawer')).toBeInTheDocument();
    const withinDrawer = within(screen.getByLabelText('Schema Hints Drawer'));
    expect(withinDrawer.getByText('Filter Attributes')).toBeInTheDocument();
    Object.values(mockStringTags).forEach(tag => {
      expect(withinDrawer.getByText(tag.key)).toBeInTheDocument();
    });
    Object.values(mockNumberTags).forEach(tag => {
      expect(withinDrawer.getByText(tag.key)).toBeInTheDocument();
    });
  });

  it('should add hint to query when clicked on drawer', async () => {
    render(
      <Subject
        stringTags={mockStringTags}
        numberTags={mockNumberTags}
        supportedAggregates={[]}
      />
    );

    const seeFullList = screen.getByText('See full list');
    await userEvent.click(seeFullList);

    expect(screen.getByLabelText('Schema Hints Drawer')).toBeInTheDocument();
    const withinDrawer = within(screen.getByLabelText('Schema Hints Drawer'));

    const stringTag1Checkbox = withinDrawer.getByText('stringTag1');
    await userEvent.click(stringTag1Checkbox);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_QUERY',
      query: 'stringTag1:""',
      focusOverride: {
        itemKey: 'filter:0',
        part: 'value',
      },
      shouldCommitQuery: false,
    });
  });

  it('should properly add aggregate hint to query', async () => {
    render(
      <Subject
        stringTags={mockStringTags}
        numberTags={mockNumberTags}
        supportedAggregates={[AggregationKey.COUNT_UNIQUE]}
      />
    );
    const countUniquePill = screen.getByText('count_unique(...)');
    await userEvent.click(countUniquePill);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_QUERY',
      query: 'count_unique(span.op):>0',
      focusOverride: {
        itemKey: 'filter:0',
        part: 'value',
      },
      shouldCommitQuery: false,
    });

    const seeFullList = screen.getByText('See full list');
    await userEvent.click(seeFullList);

    const withinDrawer = within(screen.getByLabelText('Schema Hints Drawer'));
    const countUniqueCheckbox = withinDrawer.getByText('count_unique(...)');
    await userEvent.click(countUniqueCheckbox);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_QUERY',
      query: 'count_unique(span.op):>0',
      focusOverride: {
        itemKey: 'filter:0',
        part: 'value',
      },
      shouldCommitQuery: false,
    });
  });

  it('should remove hint from query when checkbox is unchecked on drawer', async () => {
    const mockUseSearchQueryBuilder = jest
      .spyOn(
        require('sentry/components/searchQueryBuilder/context'),
        'useSearchQueryBuilder'
      )
      .mockImplementation(() => ({
        query: '!stringTag1:"" numberTag1:>0',
        getTagValues: () => Promise.resolve(['tagValue1', 'tagValue2']),
        dispatch: mockDispatch,
        wrapperRef: {current: null},
      }));

    render(
      <Subject
        stringTags={mockStringTags}
        numberTags={mockNumberTags}
        supportedAggregates={[]}
      />
    );

    const seeFullList = screen.getByText('See full list');
    await userEvent.click(seeFullList);

    const withinDrawer = within(screen.getByLabelText('Schema Hints Drawer'));
    const stringTag1Checkbox = withinDrawer.getByText('stringTag1');
    await userEvent.click(stringTag1Checkbox);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_QUERY',
      query: 'numberTag1:>0',
      focusOverride: {
        itemKey: 'filter:-1',
        part: 'value',
      },
      shouldCommitQuery: false,
    });

    mockUseSearchQueryBuilder.mockRestore();
  });

  it('should remove aggregate hint from query when checkbox is unchecked on drawer', async () => {
    const mockUseSearchQueryBuilder = jest
      .spyOn(
        require('sentry/components/searchQueryBuilder/context'),
        'useSearchQueryBuilder'
      )
      .mockImplementation(() => ({
        query: 'stringTag1:"" numberTag1:>0 count_unique(user):>0',
        getTagValues: () => Promise.resolve(['tagValue1', 'tagValue2']),
        dispatch: mockDispatch,
        wrapperRef: {current: null},
      }));

    render(
      <Subject
        stringTags={mockStringTags}
        numberTags={mockNumberTags}
        supportedAggregates={[AggregationKey.COUNT_UNIQUE]}
      />
    );

    const seeFullList = screen.getByText('See full list');
    await userEvent.click(seeFullList);

    const withinDrawer = within(screen.getByLabelText('Schema Hints Drawer'));
    const countUniqueCheckbox = withinDrawer.getByText('count_unique(...)');
    await userEvent.click(countUniqueCheckbox);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_QUERY',
      query: 'stringTag1:"" numberTag1:>0',
      focusOverride: {
        itemKey: 'filter:-1',
        part: 'value',
      },
      shouldCommitQuery: false,
    });

    mockUseSearchQueryBuilder.mockRestore();
  });

  it('should keep drawer open when query is updated', async () => {
    const {router} = render(
      <Subject
        stringTags={mockStringTags}
        numberTags={mockNumberTags}
        supportedAggregates={[]}
      />,
      {
        initialRouterConfig: {
          location: {
            pathname: '/test/path',
            query: {query: ''},
          },
        },
      }
    );

    const seeFullList = screen.getByText('See full list');
    await userEvent.click(seeFullList);

    const withinDrawer = within(screen.getByLabelText('Schema Hints Drawer'));
    const stringTag1Checkbox = withinDrawer.getByText('stringTag1');
    await userEvent.click(stringTag1Checkbox);

    router.navigate({
      pathname: '/test/path',
      search: '?query=stringTag1:""',
    });

    expect(screen.getByLabelText('Schema Hints Drawer')).toBeInTheDocument();
  });

  it('should show correct search results when query is updated', async () => {
    render(
      <Subject
        stringTags={mockStringTags}
        numberTags={mockNumberTags}
        supportedAggregates={[]}
      />
    );

    const seeFullList = screen.getByText('See full list');
    await userEvent.click(seeFullList);

    const withinDrawer = within(screen.getByLabelText('Schema Hints Drawer'));
    const searchInput = withinDrawer.getByLabelText('Search attributes');
    await userEvent.type(searchInput, 'stringTag');

    expect(withinDrawer.getByText('stringTag1')).toBeInTheDocument();
    expect(withinDrawer.getByText('stringTag2')).toBeInTheDocument();
    expect(withinDrawer.queryByText('numberTag1')).not.toBeInTheDocument();
    expect(withinDrawer.queryByText('numberTag2')).not.toBeInTheDocument();
  });

  it('should set focus override propely on duplicate filters', async () => {
    const mockUseSearchQueryBuilder = jest
      .spyOn(
        require('sentry/components/searchQueryBuilder/context'),
        'useSearchQueryBuilder'
      )
      .mockImplementation(() => ({
        query: 'stringTag1:"something"',
        getTagValues: () => Promise.resolve(['tagValue1', 'tagValue2']),
        dispatch: mockDispatch,
        wrapperRef: {current: null},
      }));

    render(
      <Subject
        stringTags={mockStringTags}
        numberTags={mockNumberTags}
        supportedAggregates={[]}
      />
    );

    const stringTag1Hint = screen.getByText('stringTag1');
    await userEvent.click(stringTag1Hint);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_QUERY',
      query: 'stringTag1:something stringTag1:""',
      focusOverride: {
        itemKey: 'filter:1',
        part: 'value',
      },
      shouldCommitQuery: false,
    });

    mockUseSearchQueryBuilder.mockRestore();
  });

  it('should filter schema hints in bar but show all in drawer for logs source', async () => {
    const logsStringTags = {
      message: {key: 'message', kind: FieldKind.TAG, name: 'message'},
      severity: {key: 'severity', kind: FieldKind.TAG, name: 'severity'},
      ...mockCustomTags,
    };

    render(
      <Subject
        stringTags={logsStringTags}
        numberTags={{}}
        supportedAggregates={[]}
        source={SchemaHintsSources.LOGS}
      />
    );

    const container = screen.getByLabelText('Schema Hints List');
    const withinContainer = within(container);

    // Bar should only show the logs hint keys (message, severity), not the custom tag
    expect(withinContainer.getByText('message')).toBeInTheDocument();
    expect(withinContainer.getByText('severity')).toBeInTheDocument();
    expect(withinContainer.queryByText('customTag')).not.toBeInTheDocument();

    const seeFullList = screen.getByText('See full list');
    await userEvent.click(seeFullList);

    expect(screen.getByLabelText('Schema Hints Drawer')).toBeInTheDocument();
    const withinDrawer = within(screen.getByLabelText('Schema Hints Drawer'));

    // Drawer should show ALL tags including the custom one
    expect(withinDrawer.getByText('message')).toBeInTheDocument();
    expect(withinDrawer.getByText('severity')).toBeInTheDocument();
    expect(withinDrawer.getByText('customTag')).toBeInTheDocument();
  });
});
