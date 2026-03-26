import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {createMockAttributeResults} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {convertRelayPiiConfig} from 'sentry/views/settings/components/dataScrubbing/convertRelayPiiConfig';
import {Add} from 'sentry/views/settings/components/dataScrubbing/modals/add';
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
const defaultAttributeResults = createMockAttributeResults();

describe('Add Modal', () => {
  beforeEach(() => {
    localStorage.clear();
    MockApiClient.clearMockResponses();
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

  it('successful submission sends correct payload', async () => {
    const closeModal = jest.fn();
    const onSubmitSuccess = jest.fn();

    const mockPutRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'PUT',
      body: {relayPiiConfig: '{}'},
    });

    render(
      <Add
        Header={makeClosableHeader(jest.fn())}
        Body={ModalBody}
        Footer={ModalFooter}
        closeModal={closeModal}
        CloseButton={makeCloseButton(jest.fn())}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={onSubmitSuccess}
      />
    );

    // Type in source field (default method=MASK, type=CREDITCARD)
    await userEvent.type(screen.getByRole('textbox', {name: 'Source'}), '$message');
    await userEvent.tab();

    await userEvent.click(screen.getByRole('button', {name: 'Save Rule'}));

    await waitFor(() => {
      expect(mockPutRequest).toHaveBeenCalled();
    });

    // Verify the submitted PII config contains the new rule
    const submittedData = JSON.parse(mockPutRequest.mock.calls[0][1].data.relayPiiConfig);

    // The new rule (creditcard + mask on $message) should be in the config
    // Rule index 3 is the new one (0-2 are existing)
    expect(submittedData.rules['3']).toEqual({
      type: 'creditcard',
      redaction: {method: 'mask'},
    });
    expect(submittedData.applications.$message).toContain('3');

    await waitFor(() => {
      expect(onSubmitSuccess).toHaveBeenCalled();
    });
    expect(closeModal).toHaveBeenCalled();
  });

  it('submission with REPLACE method includes placeholder', async () => {
    const mockPutRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'PUT',
      body: {relayPiiConfig: '{}'},
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
        onSubmitSuccess={jest.fn()}
      />
    );

    // Change method to REPLACE
    await selectEvent.select(
      screen.getByText(getMethodLabel(MethodType.MASK).label),
      getMethodLabel(MethodType.REPLACE).label
    );

    // Type custom placeholder
    await userEvent.type(screen.getByPlaceholderText('[Filtered]'), 'REDACTED');

    // Fill source
    await userEvent.type(screen.getByRole('textbox', {name: 'Source'}), '$message');
    await userEvent.tab();

    await userEvent.click(screen.getByRole('button', {name: 'Save Rule'}));

    await waitFor(() => {
      expect(mockPutRequest).toHaveBeenCalled();
    });

    const submittedData = JSON.parse(mockPutRequest.mock.calls[0][1].data.relayPiiConfig);
    expect(submittedData.rules['3']).toEqual({
      type: 'creditcard',
      redaction: {method: 'replace', text: 'REDACTED'},
    });
  });

  it('submission with PATTERN type includes pattern and replaceCaptured', async () => {
    const mockPutRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'PUT',
      body: {relayPiiConfig: '{}'},
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
        onSubmitSuccess={jest.fn()}
      />
    );

    // Change type to PATTERN (Regex matches)
    await selectEvent.select(
      screen.getByText(getRuleLabel(RuleType.CREDITCARD)),
      getRuleLabel(RuleType.PATTERN)
    );

    // Enter regex pattern with capture group
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Regex matches'}),
      '(secret).*'
    );

    // Check replaceCaptured checkbox (should be enabled due to capture group)
    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Only replace first capture match'})
    );

    // Fill source
    await userEvent.type(screen.getByRole('textbox', {name: 'Source'}), '$message');
    await userEvent.tab();

    await userEvent.click(screen.getByRole('button', {name: 'Save Rule'}));

    await waitFor(() => {
      expect(mockPutRequest).toHaveBeenCalled();
    });

    const submittedData = JSON.parse(mockPutRequest.mock.calls[0][1].data.relayPiiConfig);
    expect(submittedData.rules['3']).toEqual({
      type: 'pattern',
      pattern: '(secret).*',
      redaction: {method: 'mask'},
      replaceGroups: [1],
    });
  });

  it('validation blocks submission when source is empty', async () => {
    const mockPutRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'PUT',
      body: {relayPiiConfig: '{}'},
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
        onSubmitSuccess={jest.fn()}
      />
    );

    // Select REPLACE method
    await selectEvent.select(
      screen.getByText(getMethodLabel(MethodType.MASK).label),
      getMethodLabel(MethodType.REPLACE).label
    );

    // Submit without filling source — Zod validation should block submission
    await userEvent.click(screen.getByRole('button', {name: 'Save Rule'}));

    expect(await screen.findByText('This field is required')).toBeInTheDocument();

    // Submission should not have happened
    expect(mockPutRequest).not.toHaveBeenCalled();
  });

  it('validation blocks submission when pattern is empty for PATTERN type', async () => {
    const mockPutRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'PUT',
      body: {relayPiiConfig: '{}'},
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
        onSubmitSuccess={jest.fn()}
      />
    );

    // Change type to PATTERN
    await selectEvent.select(
      screen.getByText(getRuleLabel(RuleType.CREDITCARD)),
      getRuleLabel(RuleType.PATTERN)
    );

    // Fill source but leave pattern empty
    await userEvent.type(screen.getByRole('textbox', {name: 'Source'}), '$message');
    await userEvent.tab();

    // Submit — Zod superRefine validation should block because pattern is empty
    await userEvent.click(screen.getByRole('button', {name: 'Save Rule'}));

    expect(await screen.findByText('This field is required')).toBeInTheDocument();

    // Submission should not have happened
    expect(mockPutRequest).not.toHaveBeenCalled();
  });

  it('changing method from REPLACE clears placeholder value', async () => {
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
        onSubmitSuccess={jest.fn()}
      />
    );

    // Select REPLACE method
    await selectEvent.select(
      screen.getByText(getMethodLabel(MethodType.MASK).label),
      getMethodLabel(MethodType.REPLACE).label
    );

    // Type in placeholder
    await userEvent.type(screen.getByPlaceholderText('[Filtered]'), 'REDACTED');
    expect(screen.getByPlaceholderText('[Filtered]')).toHaveValue('REDACTED');

    // Switch to MASK
    await selectEvent.select(
      screen.getByText(getMethodLabel(MethodType.REPLACE).label),
      getMethodLabel(MethodType.MASK).label
    );

    // Placeholder field should be hidden
    expect(screen.queryByText('Custom Placeholder (Optional)')).not.toBeInTheDocument();

    // Switch back to REPLACE
    await selectEvent.select(
      screen.getByText(getMethodLabel(MethodType.MASK).label),
      getMethodLabel(MethodType.REPLACE).label
    );

    // Placeholder should be empty (value was cleared)
    expect(screen.getByPlaceholderText('[Filtered]')).toHaveValue('');
  });

  it('changing type from PATTERN clears pattern and replaceCaptured', async () => {
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
        onSubmitSuccess={jest.fn()}
      />
    );

    // Select PATTERN type
    await selectEvent.select(
      screen.getByText(getRuleLabel(RuleType.CREDITCARD)),
      getRuleLabel(RuleType.PATTERN)
    );

    // Type regex with capture group
    await userEvent.type(screen.getByRole('textbox', {name: 'Regex matches'}), '(foo)');

    // Check replaceCaptured
    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Only replace first capture match'})
    );
    expect(
      screen.getByRole('checkbox', {name: 'Only replace first capture match'})
    ).toBeChecked();

    // Switch to CREDITCARD
    await selectEvent.select(
      screen.getAllByText(getRuleLabel(RuleType.PATTERN))[0]!,
      getRuleLabel(RuleType.CREDITCARD)
    );

    // Regex field should disappear
    expect(
      screen.queryByRole('textbox', {name: 'Regex matches'})
    ).not.toBeInTheDocument();

    // Switch back to PATTERN
    await selectEvent.select(
      screen.getByText(getRuleLabel(RuleType.CREDITCARD)),
      getRuleLabel(RuleType.PATTERN)
    );

    // Pattern should be empty and replaceCaptured should be unchecked
    expect(screen.getByRole('textbox', {name: 'Regex matches'})).toHaveValue('');
    expect(
      screen.getByRole('checkbox', {name: 'Only replace first capture match'})
    ).not.toBeChecked();
  });

  it('resets replaceCaptured when pattern is edited to remove capture groups', async () => {
    const mockPutRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'PUT',
      body: {relayPiiConfig: '{}'},
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
        onSubmitSuccess={jest.fn()}
      />
    );

    // Select PATTERN type
    await selectEvent.select(
      screen.getByText(getRuleLabel(RuleType.CREDITCARD)),
      getRuleLabel(RuleType.PATTERN)
    );

    // Type regex with capture group
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Regex matches'}),
      '(secret).*'
    );

    // Check replaceCaptured
    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Only replace first capture match'})
    );
    expect(
      screen.getByRole('checkbox', {name: 'Only replace first capture match'})
    ).toBeChecked();

    // Edit the pattern to remove capture groups
    await userEvent.clear(screen.getByRole('textbox', {name: 'Regex matches'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Regex matches'}),
      'secret.*'
    );

    // Checkbox should be disabled AND unchecked (auto-reset)
    expect(
      screen.getByRole('checkbox', {name: 'Only replace first capture match'})
    ).toBeDisabled();
    expect(
      screen.getByRole('checkbox', {name: 'Only replace first capture match'})
    ).not.toBeChecked();

    // Fill source and submit
    await userEvent.type(screen.getByRole('textbox', {name: 'Source'}), '$message');
    await userEvent.tab();

    await userEvent.click(screen.getByRole('button', {name: 'Save Rule'}));

    await waitFor(() => {
      expect(mockPutRequest).toHaveBeenCalled();
    });

    // Should NOT contain replaceGroups since pattern has no capture groups
    const submittedData = JSON.parse(mockPutRequest.mock.calls[0][1].data.relayPiiConfig);
    expect(submittedData.rules['3']).toEqual({
      type: 'pattern',
      pattern: 'secret.*',
      redaction: {method: 'mask'},
    });
  });

  it('replaceCaptured checkbox is disabled without capture groups', async () => {
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
        onSubmitSuccess={jest.fn()}
      />
    );

    // Select PATTERN type
    await selectEvent.select(
      screen.getByText(getRuleLabel(RuleType.CREDITCARD)),
      getRuleLabel(RuleType.PATTERN)
    );

    // Type pattern without capture groups
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Regex matches'}),
      'secret.*'
    );

    // Checkbox should be disabled
    expect(
      screen.getByRole('checkbox', {name: 'Only replace first capture match'})
    ).toBeDisabled();

    // Clear and type pattern with capture group
    await userEvent.clear(screen.getByRole('textbox', {name: 'Regex matches'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Regex matches'}),
      'xx(secret)xx'
    );

    // Checkbox should now be enabled
    expect(
      screen.getByRole('checkbox', {name: 'Only replace first capture match'})
    ).toBeEnabled();
  });

  it('form submits even when event ID has an error', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/data-scrubbing-selector-suggestions/`,
      body: {suggestions: []},
    });

    const mockPutRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'PUT',
      body: {relayPiiConfig: '{}'},
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
        onSubmitSuccess={jest.fn()}
      />
    );

    // Toggle event ID visible
    await userEvent.click(
      screen.getByRole('button', {name: 'Use event ID for auto-completion'})
    );

    // Enter an event ID (API returns empty suggestions → NOT_FOUND status)
    await userEvent.type(
      screen.getByPlaceholderText('XXXXXXXXXXXXXX'),
      '12345678901234567890123456789012{enter}'
    );

    // Wait for NOT_FOUND status
    expect(
      await screen.findByText(
        'The chosen event ID was not found in projects you have access to'
      )
    ).toBeInTheDocument();

    // Fill source field
    await userEvent.type(screen.getByRole('textbox', {name: 'Source'}), '$message');
    await userEvent.tab();

    // Save should still work despite event ID error
    await userEvent.click(screen.getByRole('button', {name: 'Save Rule'}));

    await waitFor(() => {
      expect(mockPutRequest).toHaveBeenCalled();
    });
  });

  it('pre-fills event ID from localStorage and shows event ID field expanded', () => {
    const storedEventId = 'aabbccddeeff00112233445566778899';

    localStorage.setItem(
      'advanced-data-scrubbing',
      JSON.stringify({
        eventId: storedEventId,
        sourceSuggestions: [],
      })
    );

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
        onSubmitSuccess={jest.fn()}
      />
    );

    // Event ID field should be visible (expanded) because localStorage had an eventId
    expect(screen.getByRole('button', {name: 'Hide event ID field'})).toBeInTheDocument();

    // The event ID input should be pre-filled with the stored value
    expect(screen.getByPlaceholderText('XXXXXXXXXXXXXX')).toHaveValue(storedEventId);
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
        />
      </OrganizationContext.Provider>
    );

    await userEvent.click(screen.getByLabelText('Errors, Transactions, Attachments'));

    expect(screen.getByText('Source')).toBeInTheDocument();
    // Event ID toggle button should be present
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
        />
      </OrganizationContext.Provider>
    );

    await userEvent.click(screen.getByLabelText('Errors, Transactions, Attachments'));
    await userEvent.type(screen.getByRole('textbox', {name: 'Source'}), 'test');

    await userEvent.click(screen.getByLabelText('Logs'));

    expect(screen.getByPlaceholderText('Select or type attribute')).toHaveValue('');
  });
});
// trivial change for CI testing
