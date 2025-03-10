import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import SchemaHintsList from 'sentry/views/explore/components/schemaHintsList';

const mockStringTags: TagCollection = {
  stringTag1: {key: 'stringTag1', kind: FieldKind.TAG, name: 'stringTag1'},
  stringTag2: {key: 'stringTag2', kind: FieldKind.TAG, name: 'stringTag2'},
};

const mockNumberTags: TagCollection = {
  numberTag1: {key: 'numberTag1', kind: FieldKind.MEASUREMENT, name: 'numberTag1'},
  numberTag2: {key: 'numberTag2', kind: FieldKind.MEASUREMENT, name: 'numberTag2'},
};

jest.mock('sentry/utils/useNavigate', () => ({useNavigate: jest.fn()}));

const mockSetExploreQuery = jest.fn();
jest.mock('sentry/views/explore/contexts/pageParamsContext', () => ({
  useExploreQuery: () => '',
  useSetExploreQuery: () => mockSetExploreQuery,
}));

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
    mockSetExploreQuery.mockClear();
  });

  it('should render', () => {
    render(
      <SchemaHintsList
        stringTags={mockStringTags}
        numberTags={mockNumberTags}
        supportedAggregates={[]}
      />
    );

    expect(screen.getByText('stringTag1 is ...')).toBeInTheDocument();
    expect(screen.getByText('stringTag2 is ...')).toBeInTheDocument();
    expect(screen.getByText('numberTag1 > ...')).toBeInTheDocument();
    expect(screen.getByText('numberTag2 > ...')).toBeInTheDocument();
    expect(screen.getByText('See full list')).toBeInTheDocument();
  });

  it('should add hint to query when clicked', async () => {
    render(
      <SchemaHintsList
        stringTags={mockStringTags}
        numberTags={mockNumberTags}
        supportedAggregates={[]}
      />
    );

    const stringTag1Hint = screen.getByText('stringTag1 is ...');
    await userEvent.click(stringTag1Hint);

    expect(mockSetExploreQuery).toHaveBeenCalledWith('stringTag1:""');
  });
});
