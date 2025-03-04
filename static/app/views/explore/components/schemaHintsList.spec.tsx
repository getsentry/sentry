import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import SchemaHintsList from 'sentry/views/explore/components/schemaHintsList';

const mockStringTags: TagCollection = {
  stringTag1: {
    key: 'stringTag1',
    kind: FieldKind.TAG,
    name: 'stringTag1',
  },
  stringTag2: {
    key: 'stringTag2',
    kind: FieldKind.TAG,
    name: 'stringTag2',
  },
};

const mockNumberTags: TagCollection = {
  numberTag1: {
    key: 'numberTag1',
    kind: FieldKind.MEASUREMENT,
    name: 'numberTag1',
  },
  numberTag2: {
    key: 'numberTag2',
    kind: FieldKind.MEASUREMENT,
    name: 'numberTag2',
  },
};

describe('SchemaHintsList', () => {
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
    expect(screen.getByText('numberTag1 is ...')).toBeInTheDocument();
    expect(screen.getByText('numberTag2 is ...')).toBeInTheDocument();
    expect(screen.getByText('See full list')).toBeInTheDocument();
  });
});
