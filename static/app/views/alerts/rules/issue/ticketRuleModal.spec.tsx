import type {PropsWithChildren, ReactElement} from 'react';
import styled from '@emotion/styled';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {makeCloseButton} from 'sentry/components/globalModal/components';
import type {IssueAlertRuleAction} from 'sentry/types/alerts';
import type {IssueConfigField} from 'sentry/types/integrations';
import TicketRuleModal from 'sentry/views/alerts/rules/issue/ticketRuleModal';

jest.unmock('sentry/utils/recreateRoute');
jest.mock('sentry/actionCreators/indicator');
jest.mock('sentry/actionCreators/onboardingTasks');

describe('ProjectAlerts -> TicketRuleModal', function () {
  const closeModal = jest.fn();
  const modalElements = {
    Header: (p: PropsWithChildren) => p.children as ReactElement,
    Body: (p: PropsWithChildren) => p.children,
    Footer: (p: PropsWithChildren) => p.children,
  };

  afterEach(function () {
    closeModal.mockReset();
    MockApiClient.clearMockResponses();
  });

  const doSubmit = async () =>
    await userEvent.click(screen.getByRole('button', {name: 'Apply Changes'}));

  const submitSuccess = async () => {
    await doSubmit();
    expect(addSuccessMessage).toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();
  };

  const addMockConfigsAPICall = (otherField = {}) => {
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
          otherField,
        ],
      },
    });
  };

  const renderComponent = (
    props: Partial<IssueAlertRuleAction> = {},
    otherField: IssueConfigField = {
      label: 'Reporter',
      required: true,
      choices: [['a', 'a']],
      type: 'select',
      name: 'reporter',
    }
  ) => {
    const {organization, router} = initializeOrg();
    addMockConfigsAPICall(otherField);

    const body = styled((c: PropsWithChildren) => c.children);
    return render(
      <TicketRuleModal
        {...modalElements}
        CloseButton={makeCloseButton(() => {})}
        closeModal={closeModal}
        Body={body()}
        Footer={body()}
        formFields={{}}
        link=""
        ticketType=""
        instance={{...(props.data || {}), integration: 1}}
        index={0}
        onSubmitAction={() => {}}
        organization={organization}
      />,
      {router}
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
      await submitSuccess();
    });

    it('submit button shall be disabled if form is incomplete', async function () {
      // This doesn't test anything TicketRules specific but I'm leaving it here as an example.
      renderComponent();
      expect(screen.getByRole('button', {name: 'Apply Changes'})).toBeDisabled();
      await userEvent.hover(screen.getByRole('button', {name: 'Apply Changes'}));
      expect(
        await screen.findByText('Required fields must be filled out')
      ).toBeInTheDocument();
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

      await submitSuccess();
    });

    it('should ignore error checking when default is empty array', async function () {
      renderComponent(undefined, {
        label: 'Labels',
        required: false,
        choices: [['bug', `bug`]],
        default: undefined,
        type: 'select',
        multiple: true,
        name: 'labels',
      });
      expect(
        screen.queryAllByText(`Could not fetch saved option for Labels. Please reselect.`)
      ).toHaveLength(0);

      await selectEvent.select(screen.getByRole('textbox', {name: 'Issue Type'}), 'Epic');
      await selectEvent.select(screen.getByRole('textbox', {name: 'Labels'}), 'bug');
      await submitSuccess();
    });

    it('should persist single select values when the modal is reopened', async function () {
      renderComponent({data: {reporter: 'a'}});
      await submitSuccess();
    });

    it('should persist multi select values when the modal is reopened', async function () {
      renderComponent(
        {data: {components: ['a', 'c']}},
        {
          name: 'components',
          label: 'Components',
          default: undefined,
          type: 'select',
          multiple: true,
          required: true,
          choices: [
            ['a', 'a'],
            ['b', 'b'],
            ['c', 'c'],
          ],
        }
      );
      await submitSuccess();
    });

    it('should not persist value when unavailable in new choices', async function () {
      renderComponent({data: {reporter: 'a'}});

      addMockConfigsAPICall({
        label: 'Reporter',
        required: true,
        choices: [['b', 'b']],
        type: 'select',
        name: 'reporter',
        ignorePriorChoices: true,
      });

      // Switch Issue Type so we refetch the config and update Reporter choices
      await selectEvent.select(screen.getByRole('textbox', {name: 'Issue Type'}), 'Epic');
      await expect(
        selectEvent.select(screen.getByRole('textbox', {name: 'Reporter'}), 'a')
      ).rejects.toThrow();

      await selectEvent.select(screen.getByRole('textbox', {name: 'Reporter'}), 'b');
      await submitSuccess();
    });

    it('should persist non-choice value when the modal is reopened', async function () {
      const textField: IssueConfigField = {
        label: 'Text Field',
        required: true,
        type: 'string',
        name: 'textField',
      };
      renderComponent({data: {textField: 'foo'}}, textField);

      expect(screen.getByRole('textbox', {name: 'Text Field'})).toHaveValue('foo');
      await submitSuccess();
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

      // Component makes 1 request per character typed.
      let txt = '';
      for (const char of 'Joe') {
        txt += char;
        MockApiClient.addMockResponse({
          url: `http://example.com?field=assignee&issuetype=10001&project=10000&query=${txt}`,
          method: 'GET',
          body: [{label: 'Joe', value: 'Joe'}],
        });
      }

      const menu = screen.getByRole('textbox', {name: 'Assignee'});
      await selectEvent.openMenu(menu);
      await userEvent.type(menu, 'Joe{Escape}');
      await selectEvent.select(menu, 'Joe');

      await submitSuccess();
    });
  });
});
