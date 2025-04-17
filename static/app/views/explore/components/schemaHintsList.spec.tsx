import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import SchemaHintsList from 'sentry/views/explore/components/schemaHintsList';
import {
  PageParamsProvider,
  useExploreQuery,
} from 'sentry/views/explore/contexts/pageParamsContext';

const mockStringTags: TagCollection = {
  stringTag1: {key: 'stringTag1', kind: FieldKind.TAG, name: 'stringTag1'},
  stringTag2: {key: 'stringTag2', kind: FieldKind.TAG, name: 'stringTag2'},
};

const mockNumberTags: TagCollection = {
  numberTag1: {key: 'numberTag1', kind: FieldKind.MEASUREMENT, name: 'numberTag1'},
  numberTag2: {key: 'numberTag2', kind: FieldKind.MEASUREMENT, name: 'numberTag2'},
};

const mockDispatch = jest.fn();

// Add mock for useSearchQueryBuilder
jest.mock('sentry/components/searchQueryBuilder/context', () => ({
  useSearchQueryBuilder: () => ({
    query: '',
    getTagValues: () => Promise.resolve(['tagValue1', 'tagValue2']),
    dispatch: mockDispatch,
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
    const query = useExploreQuery();
    return <SchemaHintsList {...props} exploreQuery={query} />;
  }
  return (
    <PageParamsProvider>
      <Content />
    </PageParamsProvider>
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
  const {organization, router} = initializeOrg({
    router: {
      location: {
        query: {
          query: '',
        },
      },
    },
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render', () => {
    render(
      <Subject
        stringTags={mockStringTags}
        numberTags={mockNumberTags}
        supportedAggregates={[]}
      />
    );

    const container = screen.getByLabelText('Schema Hints List');
    const withinContainer = within(container);
    expect(withinContainer.getByText('stringTag1')).toBeInTheDocument();
    expect(withinContainer.getByText('stringTag2')).toBeInTheDocument();
    // counting the has tag
    expect(withinContainer.getAllByText('is')).toHaveLength(3);
    expect(withinContainer.getByText('numberTag1')).toBeInTheDocument();
    expect(withinContainer.getByText('numberTag2')).toBeInTheDocument();
    expect(withinContainer.getAllByText('>')).toHaveLength(2);
    // counting the has tag
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
      />,
      {organization, router}
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
      />,
      {organization, router}
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
    });
  });

  it('should remove hint from query when checkbox is unchecked on drawer', async () => {
    render(
      <Subject
        stringTags={mockStringTags}
        numberTags={mockNumberTags}
        supportedAggregates={[]}
      />,
      {
        organization,
        router: {
          ...router,
          location: {
            ...router.location,
            query: {
              query: '!stringTag1:"" numberTag1:>0',
              field: ['stringTag1', 'numberTag1'],
            },
          },
        },
      }
    );

    const seeFullList = screen.getByText('See full list');
    await userEvent.click(seeFullList);

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
    });
  });

  it('should keep drawer open when query is updated', async () => {
    render(
      <Subject
        stringTags={mockStringTags}
        numberTags={mockNumberTags}
        supportedAggregates={[]}
      />,
      {organization, router}
    );

    const seeFullList = screen.getByText('See full list');
    await userEvent.click(seeFullList);

    const withinDrawer = within(screen.getByLabelText('Schema Hints Drawer'));
    const stringTag1Checkbox = withinDrawer.getByText('stringTag1');
    await userEvent.click(stringTag1Checkbox);

    router.push({
      ...router.location,
      query: {query: '!stringTag1:""'},
    });

    expect(screen.getByLabelText('Schema Hints Drawer')).toBeInTheDocument();
  });

  it('should show correct search results when query is updated', async () => {
    render(
      <Subject
        stringTags={mockStringTags}
        numberTags={mockNumberTags}
        supportedAggregates={[]}
      />,
      {organization, router}
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
});
