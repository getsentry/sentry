import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {convertRelayPiiConfig} from 'sentry/views/settings/components/dataScrubbing/convertRelayPiiConfig';
import {Edit} from 'sentry/views/settings/components/dataScrubbing/modals/edit';
import {MethodType, RuleType} from 'sentry/views/settings/components/dataScrubbing/types';
import {
  getMethodLabel,
  getRuleLabel,
  valueSuggestions,
} from 'sentry/views/settings/components/dataScrubbing/utils';

jest.mock('sentry/actionCreators/indicator');

const relayPiiConfig = DataScrubbingRelayPiiConfigFixture();
const stringRelayPiiConfig = JSON.stringify(relayPiiConfig);
const organizationSlug = 'sentry';
const convertedRules = convertRelayPiiConfig(stringRelayPiiConfig);
const rules = convertedRules;
const rule = rules[2]!;
const projectId = 'foo';
const endpoint = `/projects/${organizationSlug}/${projectId}/`;
const api = new MockApiClient();

describe('Edit Modal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('open Edit Rule Modal', async () => {
    const handleCloseModal = jest.fn();

    render(
      <Edit
        Body={ModalBody}
        closeModal={handleCloseModal}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={jest.fn()}
        rule={rule}
      />
    );

    expect(
      screen.getByRole('heading', {name: 'Edit an advanced data scrubbing rule'})
    ).toBeInTheDocument();

    // Method Field
    expect(screen.getByText('Method')).toBeInTheDocument();
    expect(screen.getByText('What to do')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Replace'));

    Object.values(MethodType)
      .filter(method => method !== MethodType.REPLACE)
      .forEach(method => {
        expect(screen.getByText(getMethodLabel(method).label)).toBeInTheDocument();
      });

    // Placeholder Field
    expect(screen.getByText('Custom Placeholder (Optional)')).toBeInTheDocument();
    expect(
      screen.getByText('It will replace the default placeholder [Filtered]')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('[Filtered]')).toBeInTheDocument();

    // Type Field
    expect(screen.getByText('Data Type')).toBeInTheDocument();
    expect(
      screen.getByText(
        'What to look for. Use an existing pattern or define your own using regular expressions.'
      )
    ).toBeInTheDocument();
    await userEvent.click(screen.getAllByText('Regex matches')[0]!);

    Object.values(RuleType)
      .filter(ruleType => ruleType !== RuleType.PATTERN)
      .forEach(ruleType => {
        expect(screen.getByText(getRuleLabel(ruleType))).toBeInTheDocument();
      });

    await userEvent.click(screen.getAllByText('Regex matches')[0]!);

    // Regex matches Field
    expect(screen.getAllByText('Regex matches')).toHaveLength(2);
    expect(
      screen.getByText('Custom regular expression (see documentation)')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('[a-zA-Z0-9]+')).toBeInTheDocument();

    // Event ID
    expect(
      screen.getByRole('button', {name: 'Use event ID for auto-completion'})
    ).toBeInTheDocument();

    // Source Field
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Source'})).toHaveAttribute(
      'placeholder',
      'Enter a custom attribute, variable or header name'
    );

    // Close Modal
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(handleCloseModal).toHaveBeenCalled();
  });

  it('edit Rule Modal', async () => {
    const mockPutRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'PUT',
      body: {relayPiiConfig: '{}'},
    });

    render(
      <Edit
        Body={ModalBody}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={jest.fn()}
        rule={rule}
      />
    );

    // Method Field
    await selectEvent.select(screen.getByText('Replace'), 'Mask');

    // Placeholder Field should be now hidden
    expect(screen.queryByText('Custom Placeholder (Optional)')).not.toBeInTheDocument();

    // Type Field
    await selectEvent.select(screen.getAllByText('Regex matches')[0]!, 'Anything');

    // Regex Field should be now hidden
    expect(screen.queryByText('Regex matches')).not.toBeInTheDocument();

    // Source Field
    await userEvent.clear(screen.getByRole('textbox', {name: 'Source'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Source'}),
      valueSuggestions[2]!.value
    );

    // Save rule
    await userEvent.click(screen.getByRole('button', {name: 'Save Rule'}));

    await waitFor(() => {
      expect(mockPutRequest).toHaveBeenCalled();
    });

    // Verify the submitted PII config has the edited rule
    const submittedData = JSON.parse(mockPutRequest.mock.calls[0][1].data.relayPiiConfig);
    // Rule at index 2 should now be "anything" type with "mask" method
    expect(submittedData.rules['2']).toEqual({
      type: 'anything',
      redaction: {method: 'mask'},
    });
  });

  it('does not show dataset selector without ourlogs-enabled feature', () => {
    render(
      <Edit
        Body={ModalBody}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={jest.fn()}
        rule={rule}
      />
    );

    expect(screen.queryByText('Dataset')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Errors, Transactions, Attachments')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Dataset')).not.toBeInTheDocument();
    expect(screen.queryByText('Logs')).not.toBeInTheDocument();
  });

  it('surfaces invalid selector error on source field', async () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      method: 'PUT',
      statusCode: 400,
      body: {relayPiiConfig: ['invalid selector: \n1 | bad$$selector']},
    });

    render(
      <Edit
        Body={ModalBody}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={jest.fn()}
        rule={rule}
      />
    );

    await selectEvent.select(screen.getByText('Replace'), 'Mask');
    await userEvent.click(screen.getByRole('button', {name: 'Save Rule'}));

    expect(await screen.findByText(/Invalid source value/)).toBeInTheDocument();
  });

  it('surfaces regex parse error on pattern field', async () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      method: 'PUT',
      statusCode: 400,
      body: {relayPiiConfig: ['regex parse error:\nerror: unclosed group']},
    });

    render(
      <Edit
        Body={ModalBody}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={jest.fn()}
        rule={rule}
      />
    );

    await selectEvent.select(screen.getByText('Replace'), 'Mask');
    await userEvent.click(screen.getByRole('button', {name: 'Save Rule'}));

    expect(await screen.findByText(/Invalid regex/)).toBeInTheDocument();
  });

  it('shows toast for unknown server error', async () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      method: 'PUT',
      statusCode: 400,
      body: {relayPiiConfig: ['something unexpected']},
    });

    render(
      <Edit
        Body={ModalBody}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={jest.fn()}
        rule={rule}
      />
    );

    await selectEvent.select(screen.getByText('Replace'), 'Mask');
    await userEvent.click(screen.getByRole('button', {name: 'Save Rule'}));

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith(
        'An unknown error occurred while saving data scrubbing rule'
      );
    });
  });
});

describe('Edit Modal with ourlogs-enabled', () => {
  const organization = OrganizationFixture({
    features: ['ourlogs-enabled'],
  });

  beforeEach(() => {
    localStorage.clear();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [
        {key: 'user.email', name: 'user.email', kind: 'tag'},
        {key: 'user.id', name: 'user.id', kind: 'tag'},
        {key: 'custom.field', name: 'custom.field', kind: 'tag'},
        {key: 'request.method', name: 'request.method', kind: 'tag'},
        {key: 'response.status', name: 'response.status', kind: 'tag'},
      ],
    });
  });

  it('shows dataset selector when ourlogs-enabled', () => {
    render(
      <OrganizationContext.Provider value={organization}>
        <Edit
          Body={ModalBody}
          closeModal={jest.fn()}
          CloseButton={makeCloseButton(jest.fn())}
          Header={makeClosableHeader(jest.fn())}
          Footer={ModalFooter}
          projectId={projectId}
          savedRules={rules}
          api={api}
          endpoint={endpoint}
          orgSlug={organizationSlug}
          onSubmitSuccess={jest.fn()}
          rule={rule}
        />
      </OrganizationContext.Provider>
    );

    expect(screen.getByText('Dataset')).toBeInTheDocument();
    expect(screen.getByText('Errors, Transactions, Attachments')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  it('shows attribute field when logs dataset is selected', async () => {
    render(
      <OrganizationContext.Provider value={organization}>
        <Edit
          Body={ModalBody}
          closeModal={jest.fn()}
          CloseButton={makeCloseButton(jest.fn())}
          Header={makeClosableHeader(jest.fn())}
          Footer={ModalFooter}
          projectId={projectId}
          savedRules={rules}
          api={api}
          endpoint={endpoint}
          orgSlug={organizationSlug}
          onSubmitSuccess={jest.fn()}
          rule={rule}
        />
      </OrganizationContext.Provider>
    );

    await userEvent.click(screen.getByLabelText('Logs'));

    expect(screen.getByText('Attribute')).toBeInTheDocument();
    expect(screen.queryByText('Source')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Use event ID for auto-completion'})
    ).not.toBeInTheDocument();
  });
});
