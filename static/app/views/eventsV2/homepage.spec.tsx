import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';
import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import Homepage from './homepage';

describe('Discover > Homepage', () => {
  const features = [
    'global-views',
    'discover-query',
    'discover-query-builder-as-landing-page',
  ];
  let initialData, organization, mockHomepage;

  beforeEach(() => {
    organization = TestStubs.Organization({
      features,
    });
    initialData = initializeOrg({
      ...initializeOrg(),
      organization,
      router: {
        location: TestStubs.location(),
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-meta/',
      body: {
        count: 2,
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: [[123, []]]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });
    mockHomepage = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/homepage/',
      method: 'GET',
      statusCode: 200,
      body: {
        id: '2',
        name: 'homepage query',
        projects: [],
        version: 2,
        expired: false,
        dateCreated: '2021-04-08T17:53:25.195782Z',
        dateUpdated: '2021-04-09T12:13:18.567264Z',
        createdBy: {
          id: '2',
        },
        environment: ['alpha'],
        fields: ['environment'],
        widths: ['-1'],
        range: '24h',
        orderby: '-environment',
        display: 'previous',
        query: 'event.type:error',
      },
    });
  });

  it('fetches from the homepage URL and renders fields, page filters, and chart information', async () => {
    render(
      <Homepage
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
        setSavedQuery={jest.fn()}
        loading={false}
      />,
      {context: initialData.routerContext, organization: initialData.organization}
    );

    expect(mockHomepage).toHaveBeenCalled();
    await screen.findByText('environment');

    // Only the environment field
    expect(screen.getAllByTestId('grid-head-cell').length).toEqual(1);
    screen.getByText('Previous Period');
    screen.getByText('alpha');
    screen.getByText('event.type:error');
  });

  it('applies URL changes with the homepage pathname', async () => {
    render(
      <Homepage
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
        setSavedQuery={jest.fn()}
        loading={false}
      />,
      {context: initialData.routerContext, organization: initialData.organization}
    );
    userEvent.click(screen.getByText('Columns'));
    await act(async () => {
      await mountGlobalModal();
    });

    userEvent.click(screen.getByTestId('label'));
    userEvent.click(screen.getByText('event.type'));
    userEvent.click(screen.getByText('Apply'));

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/discover/homepage/',
        query: expect.objectContaining({
          field: ['event.type'],
        }),
      })
    );
  });

  it('does not show an editable header or author information', () => {
    render(
      <Homepage
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
        setSavedQuery={jest.fn()}
        loading={false}
      />,
      {context: initialData.routerContext, organization: initialData.organization}
    );

    userEvent.click(screen.getByTestId('editable-text-label'));

    // Check that clicking the label didn't render a textbox for editing
    expect(
      within(screen.getByTestId('editable-text-label')).queryByRole('textbox')
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Created by:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Last edited:/)).not.toBeInTheDocument();
  });
});
