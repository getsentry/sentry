import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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

  it('Accepts user input', () => {
    render(<SearchBar {...testProps} />);

    userEvent.type(screen.getByRole('textbox'), 'proje');
    expect(screen.getByRole('textbox')).toHaveValue('proje');
  });
});
