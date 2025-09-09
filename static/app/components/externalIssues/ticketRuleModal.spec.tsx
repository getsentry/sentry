import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import TicketRuleModal from 'sentry/components/externalIssues/ticketRuleModal';
import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import type {IssueAlertRuleAction} from 'sentry/types/alerts';
import type {IssueConfigField} from 'sentry/types/integrations';

jest.unmock('sentry/utils/recreateRoute');
jest.mock('sentry/actionCreators/indicator');

const defaultIssueConfig = [
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
] as const;

describe('ProjectAlerts -> TicketRuleModal', () => {
  const organization = OrganizationFixture();
  const onSubmitAction = jest.fn();
  const closeModal = jest.fn();
  const [
    issueTypeCode, // 10004
    issueTypeLabel, // New Feature
  ] = defaultIssueConfig[1].choices[3];

  afterEach(() => {
    closeModal.mockReset();
    MockApiClient.clearMockResponses();
  });

  const submitSuccess = async () => {
    await userEvent.click(screen.getByRole('button', {name: 'Apply Changes'}));
    expect(addSuccessMessage).toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();
  };

  const addMockConfigsAPICall = (otherField = {}) => {
    return MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/1/',
      match: [MockApiClient.matchQuery({action: 'create', ignored: ['Sprint']})],
      method: 'GET',
      body: {
        createIssueConfig: [...defaultIssueConfig, otherField],
      },
    });
  };

  const renderTicketRuleModal = async (
    props: Partial<IssueAlertRuleAction> = {},
    otherField: IssueConfigField = {
      label: 'Reporter',
      required: true,
      choices: [['a', 'a']],
      type: 'select',
      name: 'reporter',
    }
  ) => {
    addMockConfigsAPICall(otherField);

    const wrapper = render(
      <TicketRuleModal
        Body={ModalBody}
        Header={makeClosableHeader(closeModal)}
        Footer={ModalFooter}
        CloseButton={makeCloseButton(closeModal)}
        closeModal={closeModal}
        link=""
        ticketType=""
        instance={{...props.data, integration: 1}}
        onSubmitAction={onSubmitAction}
      />,
      {
        organization,
      }
    );
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();
    return wrapper;
  };

  describe('Create Rule', () => {
    it('should render the Ticket Rule modal', async () => {
      await renderTicketRuleModal();

      expect(screen.getByRole('button', {name: 'Apply Changes'})).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: 'Title'})).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: 'Description'})).toBeInTheDocument();
    });

    it('should save the modal data when "Apply Changes" is clicked with valid data', async () => {
      await renderTicketRuleModal();
      await selectEvent.select(screen.getByRole('textbox', {name: 'Reporter'}), 'a');
      await submitSuccess();
    });

    it('submit button shall be disabled if form is incomplete', async () => {
      await renderTicketRuleModal();
      await userEvent.click(screen.getByRole('textbox', {name: 'Reporter'}));
      expect(screen.getByRole('button', {name: 'Apply Changes'})).toBeDisabled();
      await userEvent.hover(screen.getByRole('button', {name: 'Apply Changes'}));
      expect(
        await screen.findByText('Required fields must be filled out')
      ).toBeInTheDocument();
    });

    it('should reload fields when an "updatesForm" field changes', async () => {
      await renderTicketRuleModal();
      await selectEvent.select(screen.getByRole('textbox', {name: 'Reporter'}), 'a');

      const dynamicQuery = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/1/',
        match: [
          MockApiClient.matchQuery({
            action: 'create',
            issuetype: issueTypeCode,
            project: '10000',
          }),
        ],
        method: 'GET',
        body: {
          createIssueConfig: [
            ...defaultIssueConfig,
            {
              label: 'Assignee',
              required: true,
              choices: [['b', 'b']],
              type: 'select',
              name: 'assignee',
            },
          ],
        },
      });

      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Issue Type'}),
        issueTypeLabel
      );
      expect(dynamicQuery).toHaveBeenCalled();
      await selectEvent.select(screen.getByRole('textbox', {name: 'Assignee'}), 'b');
      await submitSuccess();
    });

    it('should ignore error checking when default is empty array', async () => {
      const dynamicQuery = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/1/',
        match: [
          MockApiClient.matchQuery({
            action: 'create',
            issuetype: issueTypeCode,
            project: '10000',
          }),
        ],
        method: 'GET',
        body: {
          createIssueConfig: [
            ...defaultIssueConfig,
            {
              label: 'Labels',
              required: false,
              choices: [['bug', `bug`]],
              default: undefined,
              type: 'select',
              multiple: true,
              name: 'labels',
            },
          ],
        },
      });

      await renderTicketRuleModal();
      expect(
        screen.queryAllByText(`Could not fetch saved option for Labels. Please reselect.`)
      ).toHaveLength(0);
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Issue Type'}),
        issueTypeLabel
      );
      expect(dynamicQuery).toHaveBeenCalled();
      await selectEvent.select(screen.getByRole('textbox', {name: 'Labels'}), 'bug');
      await submitSuccess();
    });

    it('should persist single select values when the modal is reopened', async () => {
      await renderTicketRuleModal({data: {reporter: 'a'}});
      await submitSuccess();
    });

    it('should persist multi select values when the modal is reopened', async () => {
      await renderTicketRuleModal(
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

    it('should not persist value when unavailable in new choices', async () => {
      await renderTicketRuleModal({data: {reporter: 'a'}});

      const dynamicQuery = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/1/',
        match: [
          MockApiClient.matchQuery({
            action: 'create',
            issuetype: issueTypeCode,
            project: '10000',
          }),
        ],
        method: 'GET',
        body: {
          createIssueConfig: [
            ...defaultIssueConfig,
            {
              label: 'Reporter',
              required: true,
              choices: [['b', 'b']],
              type: 'select',
              name: 'reporter',
              ignorePriorChoices: true,
            },
          ],
        },
      });

      // Switch Issue Type so we refetch the config and update Reporter choices
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Issue Type'}),
        issueTypeLabel
      );
      expect(dynamicQuery).toHaveBeenCalled();
      await expect(
        selectEvent.select(screen.getByRole('textbox', {name: 'Reporter'}), 'a')
      ).rejects.toThrow();

      await selectEvent.select(screen.getByRole('textbox', {name: 'Reporter'}), 'b');
      await submitSuccess();
    });

    it('should persist non-choice value when the modal is reopened', async () => {
      const textField: IssueConfigField = {
        label: 'Text Field',
        required: true,
        type: 'string',
        name: 'textField',
      };
      await renderTicketRuleModal({data: {textField: 'foo'}}, textField);

      expect(screen.getByRole('textbox', {name: 'Text Field'})).toHaveValue('foo');
      await submitSuccess();
    });

    it('should get async options from URL', async () => {
      await renderTicketRuleModal();

      const dynamicQuery = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/1/',
        match: [
          MockApiClient.matchQuery({
            action: 'create',
            issuetype: issueTypeCode,
            project: '10000',
          }),
        ],
        method: 'GET',
        body: {
          createIssueConfig: [
            ...defaultIssueConfig,
            {
              label: 'Assignee',
              required: true,
              url: 'http://example.com',
              type: 'select',
              name: 'assignee',
            },
          ],
        },
      });

      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Issue Type'}),
        issueTypeLabel
      );

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
      expect(dynamicQuery).toHaveBeenCalled();
      const menu = screen.getByRole('textbox', {name: 'Assignee'});
      await selectEvent.openMenu(menu);
      await userEvent.type(menu, 'Joe{Escape}');
      await selectEvent.select(menu, 'Joe');

      await submitSuccess();
    });
  });
});
