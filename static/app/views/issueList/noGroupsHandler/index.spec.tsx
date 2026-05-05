import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {NoGroupsHandler} from 'sentry/views/issueList/noGroupsHandler';

describe('NoGroupsHandler', () => {
  const defaultProps = {
    query: '',
    organization: OrganizationFixture(),
    groupIds: [],
    selectedProjectIds: [],
  };

  it('displays default empty state when first event has been sent', async () => {
    const projectsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sent-first-event/',
      body: {sentFirstEvent: true},
    });

    render(<NoGroupsHandler {...defaultProps} />);

    expect(await screen.findByText('No issues match your search')).toBeInTheDocument();
    expect(projectsMock).not.toHaveBeenCalled();
  });

  it('collapses latest deploys when looking up the selected project', async () => {
    const projectsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [ProjectFixture({id: '1844558'})],
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/issues/',
      body: [],
    });
    const sentFirstEventMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sent-first-event/',
      body: {sentFirstEvent: false},
    });

    render(<NoGroupsHandler {...defaultProps} selectedProjectIds={[1844558]} />);

    expect(await screen.findByText(/Waiting for events/i)).toBeInTheDocument();
    expect(sentFirstEventMock).toHaveBeenCalledWith(
      '/organizations/org-slug/sent-first-event/',
      expect.objectContaining({
        query: expect.objectContaining({
          project: [1844558],
        }),
      })
    );
    expect(projectsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/projects/',
      expect.objectContaining({
        query: expect.objectContaining({
          collapse: ['latestDeploys', 'unusedFeatures'],
          per_page: 1,
          query: 'id:1844558',
        }),
      })
    );
  });

  it('displays default empty state when an error occurs', async () => {
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

  it('displays waiting for events state when first event has not been sent', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [ProjectFixture()],
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/issues/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sent-first-event/',
      body: {sentFirstEvent: false},
    });

    render(<NoGroupsHandler {...defaultProps} />);

    expect(await screen.findByText(/Waiting for events/i)).toBeInTheDocument();
  });

  it('displays waiting for events state when no projects exist yet', async () => {
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
