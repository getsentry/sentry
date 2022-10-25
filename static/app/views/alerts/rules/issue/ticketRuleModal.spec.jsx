import selectEvent from 'react-select-event';
import fetchMock from 'jest-fetch-mock';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import TicketRuleModal from 'sentry/views/alerts/rules/issue/ticketRuleModal';

jest.unmock('sentry/utils/recreateRoute');
jest.mock('sentry/actionCreators/indicator');
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
    addSuccessMessage.mockReset();
  });

  afterEach(function () {
    closeModal.mockReset();
    MockApiClient.clearMockResponses();
  });

  const doSubmit = () =>
    userEvent.click(screen.getByRole('button', {name: 'Apply Changes'}));

  const submitSuccess = () => {
    doSubmit();
    expect(addSuccessMessage).toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();
  };

  const submitErrors = errorCount => {
    doSubmit();
    expect(screen.getAllByText('Field is required')).toHaveLength(errorCount);
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

  const renderComponent = (props = {}) => {
    const {organization, routerContext} = initializeOrg(props);
    addMockConfigsAPICall({
      label: 'Reporter',
      required: true,
      choices: [['a', 'a']],
      type: 'select',
      name: 'reporter',
    });
    return render(
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
      {context: routerContext}
    );
  };

  describe('Create Rule', function () {
    it('should render the Ticket Rule modal', function () {
      renderComponent();

      expect(screen.getByRole('button', {name: 'Apply Changes'})).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: 'Title'})).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: 'Description'})).toBeInTheDocument();
    });

    it('should save the modal data when "Apply Changes" is clicked with valid data', async function () {
      renderComponent();
      await selectEvent.select(screen.getByRole('textbox', {name: 'Reporter'}), 'a');
      submitSuccess();
    });

    it('should raise validation errors when "Apply Changes" is clicked with invalid data', function () {
      // This doesn't test anything TicketRules specific but I'm leaving it here as an example.
      renderComponent();
      submitErrors(1);
    });

    it('should reload fields when an "updatesForm" field changes', async function () {
      renderComponent();
      await selectEvent.select(screen.getByRole('textbox', {name: 'Reporter'}), 'a');

      addMockConfigsAPICall({
        label: 'Assignee',
        required: true,
        choices: [['b', 'b']],
        type: 'select',
        name: 'assignee',
      });

      await selectEvent.select(screen.getByRole('textbox', {name: 'Issue Type'}), 'Epic');
      await selectEvent.select(screen.getByRole('textbox', {name: 'Assignee'}), 'b');

      submitSuccess();
    });

    it('should persist values when the modal is reopened', function () {
      renderComponent({data: {reporter: 'a'}});
      submitSuccess();
    });

    it('should get async options from URL', async function () {
      renderComponent();
      addMockConfigsAPICall({
        label: 'Assignee',
        required: true,
        url: 'http://example.com',
        type: 'select',
        name: 'assignee',
      });

      await selectEvent.select(screen.getByRole('textbox', {name: 'Issue Type'}), 'Epic');

      addMockUsersAPICall(['Marcos']);

      const menu = screen.getByRole('textbox', {name: 'Assignee'});
      selectEvent.openMenu(menu);
      userEvent.type(menu, 'Marc{esc}');
      await selectEvent.select(menu, 'Marcos');

      submitSuccess();
    });
  });
});
