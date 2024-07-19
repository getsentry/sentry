import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import NoGroupsHandler from 'sentry/views/issueList/noGroupsHandler';

describe('NoGroupsHandler', function () {
  const defaultProps = {
    api: new MockApiClient(),
    query: '',
    organization: OrganizationFixture(),
    groupIds: [],
  };

  it('displays default empty state when first event has been sent', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sent-first-event/',
      body: {sentFirstEvent: true},
    });

    render(<NoGroupsHandler {...defaultProps} />);

    expect(await screen.findByText('No issues match your search')).toBeInTheDocument();
  });

  it('displays default empty state when an error occurs', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      statusCode: 500,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sent-first-event/',
      statusCode: 500,
    });

    render(<NoGroupsHandler {...defaultProps} />);

    expect(await screen.findByText('No issues match your search')).toBeInTheDocument();
  });

  it('displays waiting for events state when first event has not been sent', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sent-first-event/',
      body: {sentFirstEvent: false},
    });

    render(<NoGroupsHandler {...defaultProps} />);

    expect(await screen.findByText(/Waiting for events/i)).toBeInTheDocument();
  });
});
