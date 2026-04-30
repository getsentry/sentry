import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {ExternalIssueForm} from 'sentry/components/externalIssues/externalIssueForm';

jest.mock('sentry/actionCreators/indicator');
import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';

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
    await userEvent.click(await screen.findByText(action));
    return wrapper;
  };

  describe('create', () => {
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

    it('should render multi-select fields and allow selecting multiple values', async () => {
      formConfig = {
        createIssueConfig: [
          {
            label: 'Labels',
            required: false,
            type: 'select',
            name: 'labels',
            multiple: true,
            choices: [
              ['bug', 'bug'],
              ['feature', 'feature'],
              ['docs', 'docs'],
            ],
          },
        ],
      };
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/`,
        body: formConfig,
      });

      const submitRequest = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/`,
        method: 'POST',
        body: {id: '123', key: 'TEST-1'},
      });

      await renderComponent();

      const labelsSelect = screen.getByRole('textbox', {name: 'Labels'});
      await selectEvent.select(labelsSelect, 'bug');
      await selectEvent.select(labelsSelect, 'feature');

      await userEvent.click(screen.getByRole('button', {name: 'Create Issue'}));

      await waitFor(() => {
        expect(submitRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({labels: ['bug', 'feature']}),
          })
        );
      });
    });

    it('should submit the form and close the modal on success', async () => {
      formConfig = {
        createIssueConfig: [
          {
            label: 'Title',
            required: true,
            type: 'string',
            name: 'title',
            default: 'Default Title',
          },
          {
            label: 'Description',
            required: false,
            type: 'textarea',
            name: 'description',
            default: '',
          },
        ],
      };
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/`,
        body: formConfig,
      });

      const submitRequest = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/`,
        method: 'POST',
        body: {id: '123', key: 'TEST-1'},
      });

      await renderComponent();

      await userEvent.click(screen.getByRole('button', {name: 'Create Issue'}));
      await waitFor(() => expect(submitRequest).toHaveBeenCalled());
      expect(onChange).toHaveBeenCalled();
      expect(closeModal).toHaveBeenCalled();
    });

    it('should switch to link action and load link config', async () => {
      formConfig = {
        createIssueConfig: [
          {
            label: 'Title',
            required: true,
            type: 'string',
            name: 'title',
            default: 'Default Title',
          },
        ],
      };
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/`,
        body: formConfig,
        match: [MockApiClient.matchQuery({action: 'create'})],
      });

      const linkConfig = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/`,
        body: {
          linkIssueConfig: [
            {
              label: 'Issue',
              required: true,
              type: 'select',
              name: 'externalIssue',
              url: '/search',
              choices: [],
            },
          ],
        },
        match: [MockApiClient.matchQuery({action: 'link'})],
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

      // Wait for initial load
      expect(await screen.findByRole('textbox', {name: 'Title'})).toBeInTheDocument();

      // Click the Link tab
      await userEvent.click(screen.getByText('Link'));
      expect(linkConfig).toHaveBeenCalled();

      // Should show link config fields, not create config fields
      expect(await screen.findByRole('textbox', {name: 'Issue'})).toBeInTheDocument();
      expect(screen.queryByRole('textbox', {name: 'Title'})).not.toBeInTheDocument();

      // Link action should show "Link Issue" button
      expect(screen.getByRole('button', {name: 'Link Issue'})).toBeInTheDocument();
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

    it('should not submit when required fields are empty', async () => {
      formConfig = {
        createIssueConfig: [
          {
            label: 'Title',
            required: true,
            type: 'string',
            name: 'title',
            default: '',
          },
          {
            label: 'Repo',
            required: true,
            type: 'select',
            name: 'repo',
            choices: [
              ['repo-1', 'Repo 1'],
              ['repo-2', 'Repo 2'],
            ],
          },
        ],
      };
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/`,
        body: formConfig,
      });

      const submitRequest = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/`,
        method: 'POST',
        body: {},
      });

      await renderComponent();

      // Click submit without filling required fields
      await userEvent.click(screen.getByRole('button', {name: 'Create Issue'}));

      // Should NOT have made an API request
      expect(submitRequest).not.toHaveBeenCalled();
      expect(closeModal).not.toHaveBeenCalled();

      // Should show inline validation errors on the required fields
      expect(screen.getByRole('textbox', {name: /title/i})).toBeInvalid();
      expect(screen.getByRole('textbox', {name: /repo/i})).toBeInvalid();
    });

    it('should show an error toast when the submit request fails', async () => {
      formConfig = {
        createIssueConfig: [
          {
            label: 'Title',
            required: true,
            type: 'string',
            name: 'title',
            default: 'Default Title',
          },
        ],
      };
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/`,
        body: formConfig,
      });

      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${group.id}/integrations/${integration.id}/`,
        method: 'POST',
        statusCode: 400,
        body: {detail: 'Something went wrong'},
      });

      await renderComponent();

      await userEvent.click(screen.getByRole('button', {name: 'Create Issue'}));

      await waitFor(() => expect(addErrorMessage).toHaveBeenCalled());
      expect(closeModal).not.toHaveBeenCalled();
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
      await screen.findByRole('textbox', {name: 'Project'});
      expect(initialQuery).toHaveBeenCalled();

      // Initial query may only have a few fields
      expect(screen.queryByRole('textbox', {name: 'Summary'})).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', {name: 'Reporter'})).not.toBeInTheDocument();

      // If the field has `updatesForm`, refetch the config.
      // If new fields are in the response, they should be visible.
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Project'}),
        'Project 1'
      );
      expect(projectOneQuery).toHaveBeenCalled();

      expect(screen.getByRole('textbox', {name: 'Summary'})).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: 'Reporter'})).toBeInTheDocument();

      // Swapping projects should refetch, and remove stale fields
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Project'}),
        'Project 2'
      );
      expect(projectTwoQuery).toHaveBeenCalled();

      expect(screen.queryByRole('textbox', {name: 'Summary'})).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', {name: 'Reporter'})).not.toBeInTheDocument();
    });

    it('should reset field values when dynamic refetch returns new config', async () => {
      MockApiClient.addMockResponse({
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
            {
              label: 'Summary',
              required: false,
              type: 'text',
              name: 'summary',
            },
          ],
        },
      });
      // After selecting Project 1, the refetch returns Summary with a new default
      MockApiClient.addMockResponse({
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
              default: 'New default from server',
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
      await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

      // Type something into Summary
      const summaryInput = screen.getByRole('textbox', {name: 'Summary'});
      await userEvent.type(summaryInput, 'User typed text');
      expect(summaryInput).toHaveValue('User typed text');

      // Select a project (triggers dynamic refetch)
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Project'}),
        'Project 1'
      );

      // Summary should be reset to the new default from the server, not preserved
      expect(screen.getByRole('textbox', {name: 'Summary'})).toHaveValue(
        'New default from server'
      );
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

    it('shows async select fields', async () => {
      await renderComponent('Link');

      // The Issue field has a url property (async select), so it should be rendered
      expect(screen.getByRole('textbox', {name: 'Issue'})).toBeInTheDocument();
    });

    describe('options loaded', () => {
      it('fetches options when user types in async select', async () => {
        // Catch-all mock for /search to prevent unmocked request errors
        MockApiClient.addMockResponse({
          url: '/search',
          body: [],
        });

        // The SelectAsyncField uses useDebouncedValue (250ms) internally
        // Dynamic field values (repo default) are included in the search URL
        const searchResponse = MockApiClient.addMockResponse({
          url: '/search',
          match: [
            MockApiClient.matchQuery({
              repo: 'scefali/test',
              field: 'externalIssue',
              query: 'faster',
            }),
          ],
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
        const textbox = screen.getByRole('textbox', {name: 'Issue'});
        await userEvent.click(textbox);
        await userEvent.type(textbox, 'faster');

        // Wait for debounce and API call
        await waitFor(() => expect(searchResponse).toHaveBeenCalled());
        expect(await screen.findByText('#2345 perf: Make it faster')).toBeInTheDocument();
      });
    });
  });
});
