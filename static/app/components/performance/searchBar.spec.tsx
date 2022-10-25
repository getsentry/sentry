import {render, screen} from 'sentry-test/reactTestingLibrary';

import SearchBar, {SearchBarProps} from 'sentry/components/performance/searchBar';
import EventView from 'sentry/utils/discover/eventView';

describe('SearchBar', () => {
  const testProps: SearchBarProps = {
    onSearch: jest.fn(),
    organization: TestStubs.Organization(),
    eventView: EventView.fromSavedQuery({
      id: '',
      name: '',
      fields: [],
      projects: [],
      version: 2,
    }),
    query: '',
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('Renders without crashing', () => {
    render(<SearchBar {...testProps} />);
  });
});
