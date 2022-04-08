import fetchMock from 'jest-fetch-mock';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {selectByQuery, selectByValue} from 'sentry-test/select-new';

import TicketRuleModal from 'sentry/views/alerts/issueRuleEditor/ticketRuleModal';

jest.unmock('sentry/utils/recreateRoute');
jest.mock('sentry/actionCreators/onboardingTasks');

describe('ProjectAlerts -> TicketRuleModal', function () {
  const closeModal = jest.fn();
  const modalElements = {
    Header: p => p.children,
    Body: p => p.children,
    Footer: p => p.children,
  };

  beforeEach(function () {
    fetchMock.enableMocks();
    fetch.resetMocks();
  });

  afterEach(function () {
    closeModal.mockReset();
    MockApiClient.clearMockResponses();
  });

  const _submit = wrapper => {
    wrapper.find('Button[data-test-id="form-submit"]').simulate('submit');
    return wrapper.find('FieldErrorReason');
  };

  const submitSuccess = wrapper => {
    const errors = _submit(wrapper);
    expect(errors).toHaveLength(0);
    expect(closeModal).toHaveBeenCalled();
  };

  const submitErrors = (wrapper, errorCount) => {
    const errors = _submit(wrapper);
    expect(errors).toHaveLength(errorCount);
    expect(errors.first().text()).toEqual('Field is required');
    expect(closeModal).toHaveBeenCalledTimes(0);
  };

  const addMockConfigsAPICall = (otherFields = {}) => {
    return MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/1/?ignored=Sprint',
      method: 'GET',
      body: {
        createIssueConfig: [
          {
            name: 'project',
            label: 'Jira Project',
            choices: [['10000', 'TEST']],
            default: '10000',
            type: 'select',
            updatesForm: true,
          },
          {
            name: 'issuetype',
            label: 'Issue Type',
            default: '10001',
            type: 'select',
            choices: [
              ['10001', 'Improvement'],
              ['10002', 'Task'],
              ['10003', 'Sub-task'],
              ['10004', 'New Feature'],
              ['10005', 'Bug'],
              ['10000', 'Epic'],
            ],
            updatesForm: true,
            required: true,
          },
          otherFields,
        ],
      },
    });
  };

  /**
   * We need to use this alternate mocking scheme because `fetch` isn't available.
   * @param names String[]
   */
  const addMockUsersAPICall = (names = []) => {
    fetch.mockResponseOnce(
      JSON.stringify(
        names.map(name => {
          return {
            label: name,
            value: name,
          };
        })
      )
    );
  };

  const createWrapper = (props = {}) => {
    const {organization, routerContext} = initializeOrg(props);
    addMockConfigsAPICall({
      label: 'Reporter',
      required: true,
      choices: [['a', 'a']],
      type: 'select',
      name: 'reporter',
    });
    return mountWithTheme(
      <TicketRuleModal
        {...modalElements}
        closeModal={closeModal}
        formFields={{}}
        link=""
        ticketType=""
        instance={{...(props.data || {}), integration: 1}}
        index={0}
        onSubmitAction={() => {}}
        organization={organization}
      />,
      routerContext
    );
  };

  describe('Create Rule', function () {
    it('should render the Ticket Rule modal', async function () {
      const wrapper = createWrapper();
      expect(wrapper.find('Button[data-test-id="form-submit"]').text()).toEqual(
        'Apply Changes'
      );

      const formFields = wrapper.find('FormField');
      expect(formFields.at(0).text()).toEqual('Title');
      expect(formFields.at(1).text()).toEqual('Description');
    });

    it('should save the modal data when "Apply Changes" is clicked with valid data', async function () {
      const wrapper = createWrapper();
      selectByValue(wrapper, 'a', {name: 'reporter'});
      submitSuccess(wrapper);
    });

    it('should raise validation errors when "Apply Changes" is clicked with invalid data', async function () {
      // This doesn't test anything TicketRules specific but I'm leaving it here as an example.
      const wrapper = createWrapper();
      submitErrors(wrapper, 1);
    });

    it('should reload fields when an "updatesForm" field changes', async function () {
      const wrapper = createWrapper();
      selectByValue(wrapper, 'a', {name: 'reporter'});

      addMockConfigsAPICall({
        label: 'Assignee',
        required: true,
        choices: [['b', 'b']],
        type: 'select',
        name: 'assignee',
      });

      selectByValue(wrapper, '10000', {name: 'issuetype'});
      selectByValue(wrapper, 'b', {name: 'assignee'});

      submitSuccess(wrapper);
    });

    it('should persist values when the modal is reopened', async function () {
      const wrapper = createWrapper({data: {reporter: 'a'}});
      submitSuccess(wrapper);
    });

    it('should get async options from URL', async function () {
      const wrapper = createWrapper();
      addMockConfigsAPICall({
        label: 'Assignee',
        required: true,
        url: 'http://example.com',
        type: 'select',
        name: 'assignee',
      });
      selectByValue(wrapper, '10000', {name: 'issuetype'});

      addMockUsersAPICall(['Marcos']);
      await selectByQuery(wrapper, 'Marcos', {name: 'assignee'});

      submitSuccess(wrapper);
    });
  });
});
