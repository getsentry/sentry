import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {TicketRuleModal} from 'sentry/components/externalIssues/ticketRuleModal';
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
    await screen.findByRole('button', {name: 'Apply Changes'});
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
              choices: [['bug', 'bug']],
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
        screen.queryAllByText('Could not fetch saved option for Labels. Please reselect.')
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

    it('should persist async select saved value when modal is reopened', async () => {
      // Simulate reopening with a previously saved async field value.
      // instance.dynamic_form_fields contains the saved field config with
      // choices from the previous search. The backend returns empty choices
      // for async fields, but the saved choices should be restored.
      const reporterField: IssueConfigField = {
        label: 'Reporter',
        required: false,
        url: 'http://example.com',
        type: 'select',
        name: 'reporter',
        choices: [], // Backend returns empty choices for async fields
      };

      addMockConfigsAPICall(reporterField);

      render(
        <TicketRuleModal
          Body={ModalBody}
          Header={makeClosableHeader(closeModal)}
          Footer={ModalFooter}
          CloseButton={makeCloseButton(closeModal)}
          closeModal={closeModal}
          link=""
          ticketType=""
          instance={{
            integration: '1',
            reporter: 'saved-user-id',
            // Saved field configs with choices from previous async search
            dynamic_form_fields: [
              ...defaultIssueConfig,
              {
                ...reporterField,
                choices: [['saved-user-id', 'Joe Smith']],
              },
            ],
          }}
          onSubmitAction={onSubmitAction}
        />,
        {organization}
      );
      // Wait for loading to finish and verify the saved value is displayed
      expect(await screen.findByText('Joe Smith')).toBeInTheDocument();

      // Submit should include the saved value
      await submitSuccess();
      const formData = onSubmitAction.mock.calls[0][0];
      expect(formData.reporter).toBe('saved-user-id');
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

      // Catch-all mock for async search endpoint
      MockApiClient.addMockResponse({
        url: 'http://example.com',
        method: 'GET',
        body: [],
      });
      // Specific mock for the full "Joe" search (after debounce)
      const searchResponse = MockApiClient.addMockResponse({
        url: 'http://example.com',
        match: [
          MockApiClient.matchQuery({
            field: 'assignee',
            query: 'Joe',
          }),
        ],
        method: 'GET',
        body: [{label: 'Joe', value: 'Joe'}],
      });

      expect(dynamicQuery).toHaveBeenCalled();
      const menu = screen.getByRole('textbox', {name: 'Assignee'});
      await userEvent.click(menu);
      await userEvent.type(menu, 'Joe');

      await waitFor(() => expect(searchResponse).toHaveBeenCalled());
      await selectEvent.select(menu, 'Joe');

      await submitSuccess();

      // The fieldOptionsCache (2nd arg) should include the search result
      // so the parent can persist it in dynamic_form_fields
      const fieldOptionsCache = onSubmitAction.mock.calls[0][1];
      expect(fieldOptionsCache).toHaveProperty('assignee');
    });

    it('should persist async search choices in fieldOptionsCache on submit', async () => {
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

      MockApiClient.addMockResponse({
        url: 'http://example.com',
        method: 'GET',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: 'http://example.com',
        match: [MockApiClient.matchQuery({field: 'assignee', query: 'Joe'})],
        method: 'GET',
        body: [{label: 'Joe', value: 'Joe'}],
      });

      expect(dynamicQuery).toHaveBeenCalled();
      const menu = screen.getByRole('textbox', {name: 'Assignee'});
      await userEvent.click(menu);
      await userEvent.type(menu, 'Joe');
      await waitFor(() =>
        expect(screen.getAllByText('Joe').length).toBeGreaterThanOrEqual(1)
      );
      await selectEvent.select(menu, 'Joe');

      await submitSuccess();

      // The second argument to onSubmitAction is the fieldOptionsCache.
      // It should include the async search result so the choice persists
      // when the modal is re-opened.
      const fieldOptionsCache = onSubmitAction.mock.calls[0][1];
      expect(fieldOptionsCache).toHaveProperty('assignee');
      expect(fieldOptionsCache.assignee).toEqual(
        expect.arrayContaining([['Joe', 'Joe']])
      );
    });
  });
});
