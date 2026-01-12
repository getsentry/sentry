import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ExternalIssueForm} from 'sentry/components/externalIssues/externalIssueForm';
import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';

jest.mock('lodash/debounce', () => {
  const debounceMap = new Map();
  const mockDebounce =
    (fn: (...args: any[]) => void, timeout: number) =>
    (...args: any[]) => {
      if (debounceMap.has(fn)) {
        clearTimeout(debounceMap.get(fn));
      }
      debounceMap.set(
        fn,
        setTimeout(() => {
          fn.apply(fn, args);
          debounceMap.delete(fn);
        }, timeout)
      );
    };
  return mockDebounce;
});

describe('ExternalIssueForm', () => {
  const group = GroupFixture();
  const integration = GitHubIntegrationFixture({externalIssues: []});
  const organization = OrganizationFixture();

  let formConfig!: any;

  const closeModal = jest.fn();
  const onChange = jest.fn();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const renderComponent = async (action = 'Create') => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/`,
      body: formConfig,
      match: [MockApiClient.matchQuery({action: 'create'})],
    });

    const wrapper = render(
      <ExternalIssueForm
        Body={ModalBody}
        Header={makeClosableHeader(closeModal)}
        Footer={ModalFooter}
        CloseButton={makeCloseButton(closeModal)}
        closeModal={closeModal}
        onChange={onChange}
        group={group}
        integration={integration}
      />,
      {organization}
    );
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText(action));
    return wrapper;
  };

  describe('create', () => {
    // TODO: expand tests
    beforeEach(() => {
      formConfig = {
        createIssueConfig: [],
      };
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/`,
        body: formConfig,
      });
    });
    it('renders', async () => {
      await renderComponent();
    });
    it('if we have an error fields, we should disable the create button', async () => {
      formConfig = {
        createIssueConfig: [
          {
            name: 'error',
            type: 'blank',
          },
        ],
      };
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/`,
        body: formConfig,
      });
      await renderComponent();

      const submitButton = screen.getByRole('button', {name: 'Create Issue'});
      expect(submitButton).toBeDisabled();
    });

    it('should refetch the form when a dynamic field is changed', async () => {
      const initialQuery = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/`,
        match: [MockApiClient.matchQuery({action: 'create'})],
        body: {
          createIssueConfig: [
            {
              label: 'Project',
              required: true,
              choices: [
                ['#proj-1', 'Project 1'],
                ['#proj-2', 'Project 2'],
              ],
              type: 'select',
              name: 'project',
              updatesForm: true,
            },
          ],
        },
      });
      const projectOneQuery = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/`,
        match: [MockApiClient.matchQuery({action: 'create', project: '#proj-1'})],
        body: {
          createIssueConfig: [
            {
              label: 'Project',
              required: true,
              choices: [
                ['#proj-1', 'Project 1'],
                ['#proj-2', 'Project 2'],
              ],
              type: 'select',
              name: 'project',
              updatesForm: true,
            },
            {
              label: 'Summary',
              required: false,
              type: 'text',
              name: 'summary',
            },
            {
              label: 'Reporter',
              required: true,
              choices: [
                ['#user-1', 'User 1'],
                ['#user-2', 'User 2'],
              ],
              type: 'select',
              name: 'reporter',
            },
          ],
        },
      });
      const projectTwoQuery = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/`,
        match: [MockApiClient.matchQuery({action: 'create', project: '#proj-2'})],
        body: {
          createIssueConfig: [
            {
              label: 'Project',
              required: true,
              choices: [
                ['#proj-1', 'Project 1'],
                ['#proj-2', 'Project 2'],
              ],
              type: 'select',
              name: 'project',
              updatesForm: true,
            },
          ],
        },
      });

      render(
        <ExternalIssueForm
          Body={ModalBody}
          Header={makeClosableHeader(closeModal)}
          Footer={ModalFooter}
          CloseButton={makeCloseButton(closeModal)}
          closeModal={closeModal}
          onChange={onChange}
          group={group}
          integration={integration}
        />,
        {organization}
      );
      expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();
      expect(initialQuery).toHaveBeenCalled();

      // Initial query may only have a few fields
      const projectSelect = screen.getByRole('textbox', {name: 'Project'});
      expect(screen.queryByRole('textbox', {name: 'Summary'})).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', {name: 'Reporter'})).not.toBeInTheDocument();

      // If the field has `updatesForm`, refetch the config.
      // If new fields are in the response, they should be visible.
      await userEvent.click(projectSelect);
      await userEvent.click(screen.getByText('Project 1'));
      expect(projectOneQuery).toHaveBeenCalled();

      // Project 1 should be selected, Project 2 should not
      expect(screen.getByText('Project 1')).toBeInTheDocument();
      expect(screen.queryByText('Project 2')).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: 'Summary'})).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: 'Reporter'})).toBeInTheDocument();

      // We should also respect new required fields
      const submitButton = screen.getByRole('button', {name: 'Create Issue'});
      expect(submitButton).toBeDisabled();
      await userEvent.click(screen.getByRole('textbox', {name: 'Reporter'}));
      await userEvent.click(screen.getByText('User 1'));
      expect(submitButton).toBeEnabled();

      // Swapping projects should refetch, and remove stale fields
      await userEvent.click(projectSelect);
      await userEvent.click(screen.getByText('Project 2'));
      expect(projectTwoQuery).toHaveBeenCalled();

      // Project 2 should be selected, Project 1 should not
      expect(screen.getByText('Project 2')).toBeInTheDocument();
      expect(screen.queryByText('Project 1')).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', {name: 'Summary'})).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', {name: 'Reporter'})).not.toBeInTheDocument();
      expect(submitButton).toBeEnabled();
    });
  });
  describe('link', () => {
    let externalIssueField!: any;
    let getFormConfigRequest!: jest.Mock;
    beforeEach(() => {
      externalIssueField = {
        name: 'externalIssue',
        default: '',
        required: true,
        choices: [],
        url: '/search',
        label: 'Issue',
        type: 'select',
      };
      formConfig = {
        status: 'active',
        name: 'scefali',
        domainName: 'github.com/scefali',
        linkIssueConfig: [
          {
            url: '/search',
            required: true,
            name: 'repo',
            default: 'scefali/test',
            updatesForm: true,
            choices: [
              ['scefali/test', 'test'],
              ['scefali/ZeldaBazaar', 'ZeldaBazaar'],
            ],
            type: 'select',
            label: 'GitHub Repository',
          },
          externalIssueField,
          {
            help: "Leave blank if you don't want to add a comment to the GitHub issue.",
            default: 'Default Value',
            required: false,
            label: 'Comment',
            type: 'textarea',
            name: 'comment',
          },
        ],
        accountType: 'User',
        provider: {
          canAdd: true,
          aspects: {
            disable_dialog: {
              body: 'Before deleting this integration, you must uninstall this integration from GitHub. After uninstalling, your integration will be disabled at which point you can choose to delete this integration.',
              actionText: 'Visit GitHub',
            },
            removal_dialog: {
              body: 'Deleting this integration will delete all associated repositories and commit data. This action cannot be undone. Are you sure you want to delete your integration?',
              actionText: 'Delete',
            },
          },
          features: ['commits', 'issue-basic'],
          canDisable: true,
          key: 'github',
          name: 'GitHub',
        },
        id: '5',
      };
      getFormConfigRequest = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/`,
        body: formConfig,
        match: [MockApiClient.matchQuery({action: 'link'})],
      });
    });

    it('renders and loads options', async () => {
      await renderComponent('Link');
      expect(getFormConfigRequest).toHaveBeenCalled();
    });

    describe('options loaded', () => {
      beforeEach(() => {
        MockApiClient.addMockResponse({
          url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/?action=link`,
          body: formConfig,
        });
      });

      it('fast typing is debounced and uses trailing call when fetching data', async () => {
        const searchResponse = MockApiClient.addMockResponse({
          url: '/search?field=externalIssue&query=faster&repo=scefali%2Ftest',
          body: [
            {
              label: '#1337 ref(js): Convert Form to a FC',
              value: 1337,
            },
            {
              label: '#2345 perf: Make it faster',
              value: 2345,
            },
          ],
        });

        await renderComponent('Link');
        jest.useFakeTimers();
        const textbox = screen.getByRole('textbox', {name: 'Issue'});
        await userEvent.click(textbox, {delay: null});
        await userEvent.type(textbox, 'faster', {delay: null});
        expect(searchResponse).not.toHaveBeenCalled();
        jest.advanceTimersByTime(300);
        expect(searchResponse).toHaveBeenCalledTimes(1);
        expect(await screen.findByText('#2345 perf: Make it faster')).toBeInTheDocument();
      });
    });
  });
});
