import {mountWithTheme} from 'sentry-test/enzyme';

import ExternalIssueForm from 'app/components/group/externalIssueForm';

jest.mock('lodash/debounce', () => {
  const debounceMap = new Map();
  const mockDebounce = (fn, timeout) => (...args) => {
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
  let group, integration, handleSubmitSuccess, wrapper, formConfig;
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    group = TestStubs.Group();
    integration = TestStubs.GitHubIntegration({externalIssues: []});
    handleSubmitSuccess = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const generateWrapper = (action = 'create') =>
    mountWithTheme(
      <ExternalIssueForm
        group={group}
        integration={integration}
        onSubmitSuccess={handleSubmitSuccess}
        action={action}
      />,
      TestStubs.routerContext()
    );

  describe('create', () => {
    // TODO: expand tests
    beforeEach(() => {
      formConfig = {
        createIssueConfig: [],
      };
      MockApiClient.addMockResponse({
        url: `/groups/${group.id}/integrations/${integration.id}/?action=create`,
        body: formConfig,
      });
    });
    it('renders', () => {
      wrapper = generateWrapper();
      expect(wrapper).toSnapshot();
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
              body:
                'Before deleting this integration, you must uninstall this integration from GitHub. After uninstalling, your integration will be disabled at which point you can choose to delete this integration.',
              actionText: 'Visit GitHub',
            },
            removal_dialog: {
              body:
                'Deleting this integration will delete all associated repositories and commit data. This action cannot be undone. Are you sure you want to delete your integration?',
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
        url: `/groups/${group.id}/integrations/${integration.id}/?action=link`,
        body: formConfig,
      });
    });
    it('renders', () => {
      wrapper = generateWrapper('link');
      expect(wrapper).toSnapshot();
    });
    it('load options', async () => {
      wrapper = generateWrapper('link');
      await tick();
      wrapper.update();
      expect(getFormConfigRequest).toHaveBeenCalled();
    });
    describe('options loaded', () => {
      let mockSuccessResponse;
      beforeEach(async () => {
        mockSuccessResponse = [42, 56];

        const mockFetchPromise = () =>
          new Promise(resolve => {
            setTimeout(() => {
              resolve({
                json: () => Promise.resolve(mockSuccessResponse),
                ok: true,
              });
            }, 50);
          });

        window.fetch = jest.fn().mockImplementation(mockFetchPromise);

        MockApiClient.addMockResponse({
          url: `/groups/${group.id}/integrations/${integration.id}/?action=link`,
          body: formConfig,
        });
        wrapper = generateWrapper('link');
        await tick();
        wrapper.update();
      });

      afterEach(() => {
        window.fetch.mockClear();
        delete window.fetch;
      });

      it('fast typing is debounced and uses trailing call when fetching data', () => {
        jest.useFakeTimers();
        wrapper.instance().getOptions(externalIssueField, 'd');
        wrapper.instance().getOptions(externalIssueField, 'do');
        wrapper.instance().getOptions(externalIssueField, 'doo');
        wrapper.instance().getOptions(externalIssueField, 'doOT');
        expect(window.fetch).toHaveBeenCalledTimes(0);
        jest.advanceTimersByTime(300);
        expect(window.fetch).toHaveBeenCalledTimes(1);
        expect(window.fetch).toHaveBeenCalledWith(
          '/search?field=externalIssue&query=doOT&repo=scefali%2Ftest'
        );
      });

      it('debounced function returns a promise with the options returned by fetch', async () => {
        const output = await wrapper.instance().getOptions(externalIssueField, 'd');
        expect(output.options).toEqual(mockSuccessResponse);
      });
    });
  });
});
