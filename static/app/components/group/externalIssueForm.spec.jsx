import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
    group = TestStubs.Group();
    integration = TestStubs.GitHubIntegration({externalIssues: []});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const renderComponent = (action = 'Create') => {
    MockApiClient.addMockResponse({
      url: `/groups/${group.id}/integrations/${integration.id}/`,
      body: formConfig,
      match: [MockApiClient.matchQuery({action: 'create'})],
    });
    const wrapper = render(
      <ExternalIssueForm
        Body={p => p.children}
        Header={p => p.children}
        group={group}
        integration={integration}
        onChange={onChange}
      />
    );
    userEvent.click(screen.getByText(action));
    return wrapper;
  };

  describe('create', () => {
    // TODO: expand tests
    beforeEach(() => {
      formConfig = {
        createIssueConfig: [],
      };
      MockApiClient.addMockResponse({
        url: `/groups/${group.id}/integrations/${integration.id}/`,
        body: formConfig,
      });
    });
    it('renders', () => {
      const {container} = renderComponent();
      expect(container).toSnapshot();
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
        url: `/groups/${group.id}/integrations/${integration.id}/`,
        body: formConfig,
        match: [MockApiClient.matchQuery({action: 'link'})],
      });
    });

    it('renders and loads options', () => {
      const {container} = renderComponent('Link');
      expect(getFormConfigRequest).toHaveBeenCalled();
      expect(container).toSnapshot();
    });

    describe('options loaded', () => {
      beforeEach(() => {
        const mockFetchPromise = () =>
          new Promise(resolve => {
            setTimeout(() => {
              resolve({
                json: () =>
                  Promise.resolve([
                    {
                      label: '#1337 ref(js): Convert Form to a FC',
                      value: 1337,
                    },
                    {
                      label: '#2345 perf: Make it faster',
                      value: 2345,
                    },
                  ]),
                ok: true,
              });
            }, 50);
          });

        window.fetch = jest.fn().mockImplementation(mockFetchPromise);

        MockApiClient.addMockResponse({
          url: `/groups/${group.id}/integrations/${integration.id}/?action=link`,
          body: formConfig,
        });
      });

      afterEach(() => {
        window.fetch.mockClear();
        delete window.fetch;
      });

      it('fast typing is debounced and uses trailing call when fetching data', async () => {
        renderComponent('Link');
        jest.useFakeTimers();
        userEvent.click(screen.getAllByText('Issue').at(1));
        userEvent.type(screen.getByRole('textbox', {name: 'Issue'}), 'doOT');
        expect(window.fetch).toHaveBeenCalledTimes(0);
        jest.advanceTimersByTime(300);
        expect(window.fetch).toHaveBeenCalledTimes(1);
        expect(window.fetch).toHaveBeenCalledWith(
          '/search?field=externalIssue&query=doOT&repo=scefali%2Ftest'
        );
        expect(await screen.findByText('#2345 perf: Make it faster')).toBeInTheDocument();
      });
    });
  });
});
