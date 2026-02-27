import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {createMockAttributeResults} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {convertRelayPiiConfig} from 'sentry/views/settings/components/dataScrubbing/convertRelayPiiConfig';
import Add from 'sentry/views/settings/components/dataScrubbing/modals/add';
import {
  AllowedDataScrubbingDatasets,
  MethodType,
  RuleType,
} from 'sentry/views/settings/components/dataScrubbing/types';
import {
  getMethodLabel,
  getRuleLabel,
} from 'sentry/views/settings/components/dataScrubbing/utils';

const relayPiiConfig = DataScrubbingRelayPiiConfigFixture();
const stringRelayPiiConfig = JSON.stringify(relayPiiConfig);
const organizationSlug = 'sentry';
const rules = convertRelayPiiConfig(stringRelayPiiConfig);
const successfullySaved = jest.fn();
const projectId = 'foo';
const endpoint = `/projects/${organizationSlug}/${projectId}/`;
const api = new MockApiClient();
const emptyAttributeResults = createMockAttributeResults(true);
const defaultAttributeResults = createMockAttributeResults();

describe('Add Modal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('open Add Rule Modal', async () => {
    const handleCloseModal = jest.fn();

    render(
      <Add
        Header={makeClosableHeader(handleCloseModal)}
        Body={ModalBody}
        Footer={ModalFooter}
        closeModal={handleCloseModal}
        CloseButton={makeCloseButton(handleCloseModal)}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={successfullySaved}
        attributeResults={emptyAttributeResults}
      />
    );

    expect(
      screen.getByRole('heading', {name: 'Add an advanced data scrubbing rule'})
    ).toBeInTheDocument();

    // Method Field
    expect(screen.getByText('Method')).toBeInTheDocument();
    expect(screen.getByText('What to do')).toBeInTheDocument();

    await userEvent.click(screen.getByText(getMethodLabel(MethodType.MASK).label));

    Object.values(MethodType).forEach(method => {
      if (method === MethodType.MASK) {
        return;
      }
      expect(screen.getByText(getMethodLabel(method).label)).toBeInTheDocument();
    });

    // Type Field
    expect(screen.getByText('Data Type')).toBeInTheDocument();
    expect(
      screen.getByText(
        'What to look for. Use an existing pattern or define your own using regular expressions.'
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByText(getRuleLabel(RuleType.CREDITCARD)));

    Object.values(RuleType).forEach(rule => {
      if (rule === RuleType.CREDITCARD) {
        return;
      }
      expect(screen.getByText(getRuleLabel(rule))).toBeInTheDocument();
    });

    // Event ID
    expect(
      screen.getByRole('button', {name: 'Use event ID for auto-completion'})
    ).toBeInTheDocument();

    // Source Field
    screen.getByRole('textbox', {name: 'Source'});

    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Where to look. In the simplest case this can be an attribute name.'
      )
    ).toBeInTheDocument();

    // Close Modal
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(handleCloseModal).toHaveBeenCalled();
  });

  it('Display placeholder field', async () => {
    render(
      <Add
        Header={makeClosableHeader(jest.fn())}
        Body={ModalBody}
        Footer={ModalFooter}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={successfullySaved}
        attributeResults={emptyAttributeResults}
      />
    );

    expect(screen.queryByText('Custom Placeholder (Optional)')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText(getMethodLabel(MethodType.MASK).label));

    await userEvent.keyboard('{arrowdown}{arrowdown}{enter}');

    expect(screen.getByText('Custom Placeholder (Optional)')).toBeInTheDocument();

    expect(screen.getByPlaceholderText('[Filtered]')).toBeInTheDocument();

    expect(
      screen.getByText('It will replace the default placeholder [Filtered]')
    ).toBeInTheDocument();
  });

  it('Display regex field', async () => {
    render(
      <Add
        Header={makeClosableHeader(jest.fn())}
        Body={ModalBody}
        Footer={ModalFooter}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={successfullySaved}
        attributeResults={emptyAttributeResults}
      />
    );

    expect(screen.queryByText('Regex matches')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText(getRuleLabel(RuleType.CREDITCARD)));

    await userEvent.keyboard(
      '{arrowdown}{arrowdown}{arrowdown}{arrowdown}{arrowdown}{arrowdown}{enter}'
    );

    expect(screen.getAllByText('Regex matches')).toHaveLength(2);

    expect(screen.getByPlaceholderText('[a-zA-Z0-9]+')).toBeInTheDocument();

    expect(
      screen.getByText('Custom regular expression (see documentation)')
    ).toBeInTheDocument();
  });

  it('Display Event Id', async () => {
    const eventId = '12345678901234567890123456789012';

    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/data-scrubbing-selector-suggestions/`,
      body: {
        suggestions: [
          {type: 'value', examples: ['34359738368'], value: "extra.'system.cpu.memory'"},
          {type: 'value', value: '$frame.abs_path'},
        ],
      },
    });

    render(
      <Add
        Header={makeClosableHeader(jest.fn())}
        Body={ModalBody}
        Footer={ModalFooter}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={successfullySaved}
        attributeResults={emptyAttributeResults}
      />
    );

    await userEvent.click(
      screen.getByRole('button', {name: 'Use event ID for auto-completion'})
    );

    await userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    expect(screen.getAllByRole('listitem')).toHaveLength(18);

    expect(screen.getByText('Event ID (Optional)')).toBeInTheDocument();

    await userEvent.type(
      screen.getByPlaceholderText('XXXXXXXXXXXXXX'),
      `${eventId}{enter}`
    );

    expect(await screen.findByTestId('icon-check-mark')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('loads source suggestions when event ID is submitted', async () => {
    // Use a unique event ID to avoid collisions with localStorage state from other tests
    const eventId = 'aabbccddeeff00112233445566778899';

    const suggestionsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/data-scrubbing-selector-suggestions/`,
      body: {
        suggestions: [
          {type: 'value', examples: ['34359738368'], value: "extra.'system.cpu.memory'"},
          {type: 'value', value: '$frame.abs_path'},
        ],
      },
    });

    render(
      <Add
        Header={makeClosableHeader(jest.fn())}
        Body={ModalBody}
        Footer={ModalFooter}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={successfullySaved}
        attributeResults={emptyAttributeResults}
      />
    );

    // No API call on mount
    expect(suggestionsRequest).not.toHaveBeenCalled();

    // Show event ID field if not already visible
    const toggleButton =
      screen.queryByRole('button', {name: 'Use event ID for auto-completion'}) ??
      screen.getByRole('button', {name: 'Hide event ID field'});
    if (toggleButton.textContent?.includes('Use event ID')) {
      await userEvent.click(toggleButton);
    }

    // Clear any pre-existing event ID value from localStorage
    const eventIdInput = screen.getByPlaceholderText('XXXXXXXXXXXXXX');
    await userEvent.clear(eventIdInput);

    await userEvent.type(eventIdInput, `${eventId}{enter}`);

    // Suggestions should load — checkmark indicates LOADED status
    expect(await screen.findByTestId('icon-check-mark')).toBeInTheDocument();

    // Verify source field shows API suggestions (2 from API + 1 default = 3)
    await userEvent.click(screen.getByRole('textbox', {name: 'Source'}));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('does not show dataset selector without ourlogs-enabled feature', () => {
    const handleCloseModal = jest.fn();

    render(
      <Add
        Header={makeClosableHeader(handleCloseModal)}
        Body={ModalBody}
        Footer={ModalFooter}
        closeModal={handleCloseModal}
        CloseButton={makeCloseButton(handleCloseModal)}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={successfullySaved}
        attributeResults={emptyAttributeResults}
      />
    );

    expect(screen.queryByText('Dataset')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Errors, Transactions, Attachments')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Logs')).not.toBeInTheDocument();
  });
});

describe('Add Modal with ourlogs-enabled', () => {
  const organization = OrganizationFixture({
    features: ['ourlogs-enabled'],
  });
  const mockAttributeResults = defaultAttributeResults;

  beforeEach(() => {
    localStorage.clear();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/trace-items/attributes/`,
      method: 'GET',
      body: Object.values(
        mockAttributeResults[AllowedDataScrubbingDatasets.LOGS]?.attributes || {}
      ).map(attr => ({
        key: attr.key,
        name: attr.name,
        kind: attr.kind,
      })),
    });
  });

  it('shows dataset selector when ourlogs-enabled', () => {
    const handleCloseModal = jest.fn();

    render(
      <OrganizationContext.Provider value={organization}>
        <Add
          Header={makeClosableHeader(handleCloseModal)}
          Body={ModalBody}
          Footer={ModalFooter}
          closeModal={handleCloseModal}
          CloseButton={makeCloseButton(handleCloseModal)}
          projectId={projectId}
          savedRules={rules}
          api={api}
          endpoint={endpoint}
          orgSlug={organizationSlug}
          onSubmitSuccess={successfullySaved}
          attributeResults={mockAttributeResults}
        />
      </OrganizationContext.Provider>
    );

    expect(screen.getByText('Dataset')).toBeInTheDocument();
    expect(screen.getByText('Errors, Transactions, Attachments')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  it('shows attribute field when logs dataset is selected', async () => {
    const handleCloseModal = jest.fn();

    // Mock the trace-items attributes API call that happens when switching to logs dataset
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

    render(
      <OrganizationContext.Provider value={organization}>
        <Add
          Header={makeClosableHeader(handleCloseModal)}
          Body={ModalBody}
          Footer={ModalFooter}
          closeModal={handleCloseModal}
          CloseButton={makeCloseButton(handleCloseModal)}
          projectId={projectId}
          savedRules={rules}
          api={api}
          endpoint={endpoint}
          orgSlug={organizationSlug}
          onSubmitSuccess={successfullySaved}
          attributeResults={mockAttributeResults}
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

  it('shows source field when default dataset is selected', async () => {
    const handleCloseModal = jest.fn();

    render(
      <OrganizationContext.Provider value={organization}>
        <Add
          Header={makeClosableHeader(handleCloseModal)}
          Body={ModalBody}
          Footer={ModalFooter}
          closeModal={handleCloseModal}
          CloseButton={makeCloseButton(handleCloseModal)}
          projectId={projectId}
          savedRules={rules}
          api={api}
          endpoint={endpoint}
          orgSlug={organizationSlug}
          onSubmitSuccess={successfullySaved}
          attributeResults={mockAttributeResults}
        />
      </OrganizationContext.Provider>
    );

    await userEvent.click(screen.getByLabelText('Errors, Transactions, Attachments'));

    expect(screen.getByText('Source')).toBeInTheDocument();
    // Event ID toggle should be present
    expect(
      screen.getByRole('button', {name: 'Use event ID for auto-completion'})
    ).toBeInTheDocument();
    expect(screen.queryByText('Attribute')).not.toBeInTheDocument();
  });

  it('clears source when switching datasets', async () => {
    const handleCloseModal = jest.fn();

    // Mock the trace-items attributes API call that happens when switching to logs dataset
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

    render(
      <OrganizationContext.Provider value={organization}>
        <Add
          Header={makeClosableHeader(handleCloseModal)}
          Body={ModalBody}
          Footer={ModalFooter}
          closeModal={handleCloseModal}
          CloseButton={makeCloseButton(handleCloseModal)}
          projectId={projectId}
          savedRules={rules}
          api={api}
          endpoint={endpoint}
          orgSlug={organizationSlug}
          onSubmitSuccess={successfullySaved}
          attributeResults={mockAttributeResults}
        />
      </OrganizationContext.Provider>
    );

    await userEvent.click(screen.getByLabelText('Errors, Transactions, Attachments'));
    await userEvent.type(screen.getByRole('textbox', {name: 'Source'}), 'test');

    await userEvent.click(screen.getByLabelText('Logs'));

    expect(screen.getByPlaceholderText('Select or type attribute')).toHaveValue('');
  });
});
