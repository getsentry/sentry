import {browserHistory} from 'react-router';
import type {Location} from 'history';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {Organization} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventView, {EventData} from 'sentry/utils/discover/eventView';

import ActionDropDown, {ContextValueType} from './actionDropdown';

const dataRow: EventData = {
  id: '6b43e285de834ec5b5fe30d62d549b20',
  issue: 'SENTRY-VVY',
  release: 'backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76',
  'issue.id': 3512441874,
  'project.name': 'sentry',
};

const mockEventView = EventView.fromSavedQuery({
  id: '',
  name: 'test query',
  version: 2,
  fields: ['title', 'issue'],
  query: 'event.type:error',
  projects: [1],
});

const mockedLocation = LocationFixture({
  query: {
    field: 'title',
  },
});

const renderActionDropdown = (
  location: Location,
  eventView: EventView,
  queryKey: string,
  value: React.ReactText | string[],
  contextValueType: ContextValueType
) => {
  const organization = Organization();
  render(
    <ActionDropDown
      dataRow={dataRow}
      organization={organization}
      location={location}
      eventView={eventView}
      queryKey={queryKey}
      value={value}
      contextValueType={contextValueType}
    />,
    {organization}
  );
};

describe('Quick Context Actions', function () {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('Renders correct options for string context value', async () => {
    renderActionDropdown(
      mockedLocation,
      mockEventView,
      'title',
      'Undefined: Error',
      ContextValueType.STRING
    );

    const trigger = await screen.findByTestId('quick-context-action-trigger');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger);

    const menuOptions = await screen.findAllByRole('menuitemradio');
    expect(menuOptions.map(e => e.textContent)).toEqual([
      'Add as column',
      'Add to filter',
      'Exclude from filter',
    ]);
  });

  it('Renders correct options for non-string context value', async () => {
    renderActionDropdown(
      mockedLocation,
      mockEventView,
      'transaction.duration',
      '14.00ms',
      ContextValueType.DURATION
    );

    const trigger = await screen.findByTestId('quick-context-action-trigger');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger);

    const menuOptions = await screen.findAllByRole('menuitemradio');
    expect(menuOptions.map(e => e.textContent)).toEqual([
      'Add as column',
      'Show values greater than',
      'Show values less than',
    ]);
  });

  it('Adds context as column', async () => {
    renderActionDropdown(
      mockedLocation,
      mockEventView,
      'transaction.duration',
      '14.00ms',
      ContextValueType.DURATION
    );

    const trigger = await screen.findByTestId('quick-context-action-trigger');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger);

    const addAsColumn = await screen.findByRole('menuitemradio', {name: 'Add as column'});

    await userEvent.click(addAsColumn);

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/mock-pathname/',
        query: expect.objectContaining({
          field: ['title', 'issue', 'transaction.duration'],
        }),
      })
    );
  });

  it('Adds context to filter', async () => {
    renderActionDropdown(
      mockedLocation,
      mockEventView,
      'title',
      'Undefined: Error',
      ContextValueType.STRING
    );

    const trigger = await screen.findByTestId('quick-context-action-trigger');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger);

    const addToFilter = await screen.findByRole('menuitemradio', {name: 'Add to filter'});

    await userEvent.click(addToFilter);

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/mock-pathname/',
        query: expect.objectContaining({
          query: 'event.type:error title:"Undefined: Error"',
        }),
      })
    );
  });

  it('Excludes context from filter', async () => {
    renderActionDropdown(
      mockedLocation,
      mockEventView,
      'title',
      'Undefined: Error',
      ContextValueType.STRING
    );

    const trigger = await screen.findByTestId('quick-context-action-trigger');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger);

    const addToFilter = await screen.findByRole('menuitemradio', {
      name: 'Exclude from filter',
    });

    await userEvent.click(addToFilter);

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/mock-pathname/',
        query: expect.objectContaining({
          query: 'event.type:error !title:"Undefined: Error"',
        }),
      })
    );
  });

  it('Filters by values greater than', async () => {
    renderActionDropdown(
      mockedLocation,
      mockEventView,
      'transaction.duration',
      '14.00ms',
      ContextValueType.DURATION
    );

    const trigger = await screen.findByTestId('quick-context-action-trigger');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger);

    const showGreaterThanBtn = await screen.findByRole('menuitemradio', {
      name: 'Show values greater than',
    });

    await userEvent.click(showGreaterThanBtn);

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/mock-pathname/',
        query: expect.objectContaining({
          query: 'event.type:error transaction.duration:>14.00ms',
        }),
      })
    );
  });

  it('Filters by values less than', async () => {
    renderActionDropdown(
      mockedLocation,
      mockEventView,
      'transaction.duration',
      '14.00ms',
      ContextValueType.DURATION
    );

    const trigger = await screen.findByTestId('quick-context-action-trigger');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger);

    const showLessThanBtn = await screen.findByRole('menuitemradio', {
      name: 'Show values less than',
    });

    await userEvent.click(showLessThanBtn);

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/mock-pathname/',
        query: expect.objectContaining({
          query: 'event.type:error transaction.duration:<14.00ms',
        }),
      })
    );
  });
});
