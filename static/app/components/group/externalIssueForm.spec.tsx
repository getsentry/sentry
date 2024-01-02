import styled from '@emotion/styled';
import {GitHubIntegration as GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {Group as GroupFixture} from 'sentry-fixture/group';
import {Organization} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {makeCloseButton} from 'sentry/components/globalModal/components';
import ExternalIssueForm from 'sentry/components/group/externalIssueForm';

jest.mock('lodash/debounce', () => {
  const debounceMap = new Map();
  const mockDebounce =
    (fn, timeout) =>
    (...args) => {
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
  let group, integration, formConfig;
  const onChange = jest.fn();
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    group = GroupFixture();
    integration = GitHubIntegrationFixture({externalIssues: []});
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

    const styledWrapper = styled(c => c.children);
    const wrapper = render(
      <ExternalIssueForm
        Body={styledWrapper()}
        Footer={styledWrapper()}
        organization={Organization()}
        Header={c => <span>{c.children}</span>}
        group={group}
        integration={integration}
        onChange={onChange}
        CloseButton={makeCloseButton(() => {})}
        closeModal={() => {}}
      />
    );
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
  });
  describe('link', () => {
    let externalIssueField, getFormConfigRequest;
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
