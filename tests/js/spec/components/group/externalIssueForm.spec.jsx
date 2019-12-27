import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import ExternalIssueForm from 'app/components/group/externalIssueForm';

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
      expect(wrapper).toMatchSnapshot();
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
            choices: [['scefali/test', 'test'], ['scefali/ZeldaBazaar', 'ZeldaBazaar']],
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
      expect(wrapper).toMatchSnapshot();
    });
    it('load options', async () => {
      wrapper = generateWrapper('link');
      await tick();
      wrapper.update();
      expect(getFormConfigRequest).toHaveBeenCalled();
    });
    describe('options loaded', () => {
      let mockSuccessResponse, timeDelay;
      beforeEach(async () => {
        timeDelay = 50;
        mockSuccessResponse = [];

        const mockFetchPromise = () =>
          new Promise(resolve => {
            setTimeout(() => {
              resolve({
                json: () => Promise.resolve(mockSuccessResponse),
                ok: true,
              });
            }, timeDelay);
          });

        window.fetch = jest.fn().mockImplementation(mockFetchPromise); // 4

        MockApiClient.addMockResponse({
          url: `/groups/${group.id}/integrations/${integration.id}/?action=link`,
          body: formConfig,
        });
        wrapper = generateWrapper('link');
        await tick();
        wrapper.update();

        jest.useFakeTimers();
      });

      it('long delay in typing', () => {
        wrapper.instance().getOptions(externalIssueField, 'd');
        jest.advanceTimersByTime(300);
        expect(window.fetch).toHaveBeenCalledTimes(1);
        wrapper.instance().getOptions(externalIssueField, 'do');
        jest.advanceTimersByTime(300);
        expect(window.fetch).toHaveBeenCalledTimes(2);
      });

      it('fast typing is debounced', () => {
        wrapper.instance().getOptions(externalIssueField, 'd');
        jest.advanceTimersByTime(10);
        expect(window.fetch).toHaveBeenCalledTimes(0);
        wrapper.instance().getOptions(externalIssueField, 'do');
        jest.advanceTimersByTime(10);
        expect(window.fetch).toHaveBeenCalledTimes(0);
        jest.advanceTimersByTime(300);
        expect(window.fetch).toHaveBeenCalledTimes(1);
      });

      it('debounced calls should wait until async calls to finish', async () => {
        //add delay longer than debounce period
        timeDelay = 1000;
        const outputs = [undefined, undefined];
        wrapper
          .instance()
          .getOptions(externalIssueField, 'd')
          .then(out => {
            outputs[0] = out;
          });
        jest.advanceTimersByTime(10);
        wrapper
          .instance()
          .getOptions(externalIssueField, 'do')
          .then(out => {
            outputs[1] = out;
          });
        expect(window.fetch).toHaveBeenCalledTimes(0);
        jest.advanceTimersByTime(300);
        expect(window.fetch).toHaveBeenCalledTimes(1);

        expect(outputs).toEqual([undefined, undefined]);
        mockSuccessResponse = [1, 2];

        jest.advanceTimersByTime(1200);
        jest.useRealTimers();
        await tick();
        expect(window.fetch).toHaveBeenCalledTimes(1);
        expect(outputs[0].options).toEqual(mockSuccessResponse);
        expect(outputs[1].options).toEqual(mockSuccessResponse);
      });
    });
  });
});
