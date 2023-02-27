import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventMetas, {getEventDetailHeaderCols} from './eventMetas';

describe('EventMetas', () => {
  it('Displays event created and received dates when hovering', async () => {
    const event = {
      ...TestStubs.Event(),
      dateReceived: '2017-05-21T18:01:48.762Z',
      dateCreated: '2017-05-21T18:02:48.762Z',
    };
    const routerContext = TestStubs.routerContext([]);
    const organization = TestStubs.Organization({});
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    render(
      <EventMetas
        event={event}
        location={routerContext.context.location}
        organization={organization}
        errorDest="discover"
        transactionDest="discover"
        meta={null}
        projectId="1"
        quickTrace={null}
      />
    );
    userEvent.hover(screen.getByText('5 months ago'));
    expect(await screen.findByText('Occurred')).toBeInTheDocument();
    expect(screen.getByText(/6:01:48 PM UTC/)).toBeInTheDocument();
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText(/6:02:48 PM UTC/)).toBeInTheDocument();
  });
});

describe('getEventDetailHeaderCols', () => {
  it.each([
    [
      true,
      true,
      'transaction',
      'grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr) minmax(160px, 1fr) minmax(160px, 1fr)  5fr minmax(325px, 1fr);',
    ],
    [
      false,
      false,
      'transaction',
      'grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr) minmax(160px, 1fr)  6fr;',
    ],
    [
      true,
      false,
      'transaction',
      'grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr) minmax(160px, 1fr)  5fr minmax(325px, 1fr);',
    ],
    [
      false,
      true,
      'transaction',
      'grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr) minmax(160px, 1fr) minmax(160px, 1fr)  6fr;',
    ],
    [
      true,
      true,
      'error',
      'grid-template-columns: minmax(160px, 1fr) minmax(200px, 1fr) 5fr minmax(325px, 1fr);',
    ],
    [
      false,
      false,
      'error',
      'grid-template-columns: minmax(160px, 1fr) minmax(200px, 1fr) 6fr;',
    ],
    [
      true,
      false,
      'error',
      'grid-template-columns: minmax(160px, 1fr) minmax(200px, 1fr) 5fr minmax(325px, 1fr);',
    ],
    [
      false,
      true,
      'error',
      'grid-template-columns: minmax(160px, 1fr) minmax(200px, 1fr) 6fr;',
    ],
  ])('(%s, %s, %s)', (hasReplay, isBackendProject, type, expected) => {
    expect(getEventDetailHeaderCols({hasReplay, isBackendProject, type})).toEqual(
      expected
    );
  });
});
