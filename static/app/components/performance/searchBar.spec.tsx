import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import type {SearchBarProps} from 'sentry/components/performance/searchBar';
import SearchBar from 'sentry/components/performance/searchBar';
import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

describe('SearchBar', () => {
  let eventsMock;
  const organization = OrganizationFixture();

  const testProps: SearchBarProps = {
    onSearch: jest.fn(),
    organization,
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
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();

    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });
  });

  it('Sends user input as a transaction search and shows the results', async () => {
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [{transaction: 'clients.call'}, {transaction: 'clients.fetch'}],
      },
    });

    render(<SearchBar {...testProps} />);

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.paste('proje');
    expect(screen.getByRole('textbox')).toHaveValue('proje');

    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'transaction:*proje* event.type:transaction',
        }),
      })
    );

    expect(screen.getByText(textWithMarkupMatcher('clients.call'))).toBeInTheDocument();
    expect(screen.getByText(textWithMarkupMatcher('clients.fetch'))).toBeInTheDocument();
  });

  it('Responds to keyboard navigation', async () => {
    const onSearch = jest.fn();
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {project_id: 1, transaction: 'clients.call'},
          {project_id: 1, transaction: 'clients.fetch'},
        ],
      },
    });
    render(<SearchBar {...testProps} onSearch={onSearch} />);

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.paste('proje');
    expect(screen.getByTestId('smart-search-dropdown')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('smart-search-dropdown')).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'client');
    expect(screen.getByTestId('smart-search-dropdown')).toBeInTheDocument();

    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');

    expect(screen.queryByTestId('smart-search-dropdown')).not.toBeInTheDocument();
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('transaction:"clients.fetch"');
  });

  it('Submits wildcard searches as raw text searches', async () => {
    const onSearch = jest.fn();
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {project_id: 1, transaction: 'clients.call'},
          {project_id: 1, transaction: 'clients.fetch'},
        ],
      },
    });
    render(<SearchBar {...testProps} onSearch={onSearch} />);

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.paste('client*');
    expect(screen.getByTestId('smart-search-dropdown')).toBeInTheDocument();

    await userEvent.keyboard('{Enter}');

    expect(screen.queryByTestId('smart-search-dropdown')).not.toBeInTheDocument();
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('client*');
  });

  it('closes the search dropdown when clicked outside of', async () => {
    const onSearch = jest.fn();
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {project_id: 1, transaction: 'clients.call'},
          {project_id: 1, transaction: 'clients.fetch'},
        ],
      },
    });
    render(
      <Fragment>
        <div data-test-id="some-div" />
        <SearchBar {...testProps} onSearch={onSearch} />
      </Fragment>
    );

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.paste('proje');
    expect(screen.getByTestId('smart-search-dropdown')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('some-div'));
    expect(screen.queryByTestId('smart-search-dropdown')).not.toBeInTheDocument();
  });

  it('properly formats transaction queries that include a space', async () => {
    const onSearch = jest.fn();
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [{transaction: 'GET /my-endpoint'}],
      },
    });

    render(<SearchBar {...testProps} onSearch={onSearch} />);

    await userEvent.type(screen.getByRole('textbox'), 'GET /my-endpoint');

    await screen.findByText('GET /my-endpoint');

    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('transaction:"GET /my-endpoint"');
  });

  it('appends additional filters', async () => {
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [{transaction: 'clients.call'}, {transaction: 'clients.fetch'}],
      },
    });

    render(
      <SearchBar
        {...testProps}
        additionalConditions={new MutableSearch(['transaction.op:ui.load'])}
      />
    );

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.paste('proje');
    expect(screen.getByRole('textbox')).toHaveValue('proje');

    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'transaction.op:ui.load transaction:*proje* event.type:transaction',
        }),
      })
    );

    expect(screen.getByText(textWithMarkupMatcher('clients.call'))).toBeInTheDocument();
    expect(screen.getByText(textWithMarkupMatcher('clients.fetch'))).toBeInTheDocument();
  });
});
