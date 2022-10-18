import {fireEvent, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import {CreateProject} from 'sentry/views/projectInstall/createProject';

jest.mock('sentry/actionCreators/modal');

describe('CreateProject', function () {
  const teamNoAccess = {slug: 'test', id: '1', name: 'test', hasAccess: false};
  const teamWithAccess = {...teamNoAccess, hasAccess: true};

  const baseProps = {
    api: new MockApiClient(),
    location: {query: {}},
    organization: TestStubs.Organization(),
    teams: [teamNoAccess],
    params: {
      projectId: '',
      orgId: 'testOrg',
    },
  };

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/testOrg/rule-conditions/`,
      body: {},
      // Not required for these tests
      statusCode: 500,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should block if you have access to no teams', function () {
    const wrapper = render(<CreateProject {...baseProps} />, {
      context: TestStubs.routerContext([{organization: {id: '1', slug: 'testOrg'}}]),
    });

    expect(wrapper.container).toSnapshot();
  });

  it('can create a new team', function () {
    render(<CreateProject {...baseProps} />, {
      context: TestStubs.routerContext([{organization: {id: '1', slug: 'testOrg'}}]),
    });

    userEvent.click(screen.getByRole('button', {name: 'Create a team'}));
    expect(openCreateTeamModal).toHaveBeenCalled();
  });

  it('should fill in project name if its empty when platform is chosen', function () {
    const wrapper = render(<CreateProject {...baseProps} teams={[teamWithAccess]} />, {
      context: TestStubs.routerContext([
        {organization: {id: '1', slug: 'testOrg'}, location: {query: {}}},
      ]),
    });

    userEvent.click(screen.getByTestId('platform-apple-ios'));
    expect(screen.getByPlaceholderText('project-name')).toHaveValue('apple-ios');

    userEvent.click(screen.getByTestId('platform-ruby-rails'));
    expect(screen.getByPlaceholderText('project-name')).toHaveValue('ruby-rails');

    // but not replace it when project name is something else:
    userEvent.clear(screen.getByPlaceholderText('project-name'));
    userEvent.type(screen.getByPlaceholderText('project-name'), 'another');

    userEvent.click(screen.getByTestId('platform-apple-ios'));
    expect(screen.getByPlaceholderText('project-name')).toHaveValue('another');

    expect(wrapper.container).toSnapshot();
  });

  it('should fill in platform name if its provided by url', function () {
    const props = {
      ...baseProps,
      location: {query: {platform: 'ruby-rails'}},
    };

    const wrapper = render(<CreateProject {...props} teams={[teamWithAccess]} />, {
      context: TestStubs.routerContext([{organization: {id: '1', slug: 'testOrg'}}]),
    });

    expect(screen.getByPlaceholderText('project-name')).toHaveValue('Rails');

    expect(wrapper.container).toSnapshot();
  });

  it('should fill in category name if its provided by url', function () {
    const props = {
      ...baseProps,
      location: {query: {category: 'mobile'}},
    };

    render(<CreateProject {...props} teams={[teamWithAccess]} />, {
      context: TestStubs.routerContext([{organization: {id: '1', slug: 'testOrg'}}]),
    });

    expect(screen.getByTestId('platform-apple-ios')).toBeInTheDocument();
    expect(screen.queryByTestId('platform-ruby-rails')).not.toBeInTheDocument();
  });

  it('should deal with incorrect platform name if its provided by url', function () {
    const wrapper = render(<CreateProject {...baseProps} teams={[teamWithAccess]} />, {
      context: TestStubs.routerContext([
        {
          organization: {id: '1', slug: 'testOrg'},
          location: {query: {platform: 'XrubyROOLs'}},
        },
      ]),
    });

    expect(screen.getByPlaceholderText('project-name')).toHaveValue('');

    expect(wrapper.container).toSnapshot();
  });

  describe('Issue Alerts Options', () => {
    const props = {
      ...baseProps,
      teams: [teamWithAccess],
    };
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/projects/${props.organization.slug}/rule-conditions/`,
        body: TestStubs.MOCK_RESP_VERBOSE,
      });
    });

    afterEach(() => {
      MockApiClient.clearMockResponses();
    });

    it('should enabled the submit button if and only if all the required information has been filled', () => {
      render(<CreateProject {...props} />, {
        context: TestStubs.routerContext([
          {
            location: {query: {}},
          },
        ]),
      });

      const createProjectButton = screen.getByTestId('create-project');

      userEvent.click(screen.getByText(/When there are more than/));
      expect(createProjectButton).toBeDisabled();

      userEvent.paste(screen.getByTestId('range-input'), '2', {skipClick: true});
      expect(screen.getByTestId('range-input')).toHaveValue(2);
      expect(createProjectButton).toBeDisabled();

      userEvent.click(screen.getByTestId('platform-apple-ios'));
      expect(createProjectButton).toBeEnabled();

      userEvent.clear(screen.getByTestId('range-input'));
      expect(createProjectButton).toBeEnabled();

      userEvent.paste(screen.getByTestId('range-input'), '2712', {skipClick: true});
      expect(createProjectButton).toBeEnabled();

      fireEvent.change(screen.getByTestId('range-input'), {target: {value: ''}});
      expect(createProjectButton).toBeDisabled();

      userEvent.click(screen.getByText("I'll create my own alerts later"));
      expect(createProjectButton).toBeEnabled();
    });
  });
});
