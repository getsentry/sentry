import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
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

  it('checks first events and projects for only the selected projects', async () => {
    const sentFirstEvent = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sent-first-event/',
      body: {sentFirstEvent: false},
      match: [MockApiClient.matchQuery({project: [1, 2]})],
    });
    const projects = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [ProjectFixture()],
      match: [MockApiClient.matchQuery({query: 'id:1 id:2'})],
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/issues/',
      body: [],
    });

    render(<NoGroupsHandler {...defaultProps} selectedProjectIds={[1, 2]} />);

    expect(await screen.findByText(/Waiting for events/i)).toBeInTheDocument();
    expect(sentFirstEvent).toHaveBeenCalled();
    expect(projects).toHaveBeenCalled();
  });

  it('checks first events across all projects when all projects are selected', async () => {
    const sentFirstEvent = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sent-first-event/',
      body: {sentFirstEvent: true},
    });

    render(
      <NoGroupsHandler {...defaultProps} selectedProjectIds={[ALL_ACCESS_PROJECTS]} />
    );

    expect(await screen.findByText('No issues match your search')).toBeInTheDocument();
    expect(sentFirstEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({query: undefined})
    );
  });
});
