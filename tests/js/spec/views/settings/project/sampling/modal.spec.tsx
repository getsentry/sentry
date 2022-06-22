import {
  screen,
  userEvent,
  waitForElementToBeRemoved,
  within,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {SamplingInnerName, SamplingRuleType} from 'sentry/types/sampling';
import {
  distributedTracesConditions,
  individualTransactionsConditions,
} from 'sentry/views/settings/project/sampling/modal/utils';
import {
  getInnerNameLabel,
  LEGACY_BROWSER_LIST,
} from 'sentry/views/settings/project/sampling/utils';

import {openSamplingRuleModal, renderComponent} from './utils';

describe('Sampling - Modal', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: TestStubs.Project(),
    });

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/tags/',
      body: TestStubs.Tags,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/release/values/',
      method: 'GET',
      body: [{value: '1.2.3'}],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('saves distributed traces rule', async function () {
    const rule = {
      condition: {
        inner: [{name: 'trace.release', op: 'glob', value: ['1.2.3']}],
        op: 'and',
      },
      id: 0,
      sampleRate: 0.2,
      type: 'trace',
    };

    const saveMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: TestStubs.Project({
        dynamicSampling: {
          rules: [rule],
          next_id: 41,
        },
      }),
    });

    renderComponent({ruleType: SamplingRuleType.TRACE});

    // Open Modal
    await openSamplingRuleModal(screen.getByText('Add Rule'));
    const dialog = screen.getByRole('dialog');

    // Modal description
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'Using a Trace ID, select all Transactions distributed across multiple projects/services which match your conditions. However, if you only want to select Transactions from within this project, we recommend you add a Individual Transaction rule instead.'
        )
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Individual Transaction'})).toHaveAttribute(
      'href',
      `${SamplingRuleType.TRANSACTION}/`
    );

    // Empty conditions message
    expect(screen.getByText('No conditions added')).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          "if you don't want to add (+) a condition, simply, add a sample rate below"
        )
      )
    ).toBeInTheDocument();

    // Click on 'Add condition'
    userEvent.click(screen.getByText('Add Condition'));

    // Autocomplete
    expect(screen.getByText(/filter conditions/i)).toBeInTheDocument();

    // Distributed Traces Options
    distributedTracesConditions.forEach(condition => {
      expect(within(dialog).getByText(getInnerNameLabel(condition))).toBeInTheDocument();
    });
    expect(
      within(dialog).queryByText(
        getInnerNameLabel(SamplingInnerName.EVENT_LEGACY_BROWSER)
      )
    ).not.toBeInTheDocument();

    // Click on the condition option
    userEvent.click(screen.getAllByText('Release')[0]);

    // Release field is empty
    expect(screen.queryByTestId('multivalue')).not.toBeInTheDocument();

    // Type into release field
    userEvent.paste(screen.getByLabelText('Search or add a release'), '1.2.3');

    // Autocomplete suggests options
    expect(screen.getByTestId('1.2.3')).toHaveTextContent('1.2.3');

    // Click on the suggested option
    userEvent.click(screen.getByTestId('1.2.3'));

    // Button is still disabled
    expect(screen.getByLabelText('Save Rule')).toBeDisabled();

    // Fill sample rate field
    userEvent.paste(screen.getByPlaceholderText('\u0025'), '20');

    // Save button is now enabled
    expect(screen.getByLabelText('Save Rule')).toBeEnabled();

    // Click on save button
    userEvent.click(screen.getByLabelText('Save Rule'));

    // Close Modal
    userEvent.click(screen.getByLabelText('Close Modal'));
    await waitForElementToBeRemoved(() =>
      screen.queryByText('Add Distributed Trace Rule')
    );

    expect(saveMock).toHaveBeenLastCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({
        data: {
          dynamicSampling: {
            rules: [rule],
          },
        },
      })
    );

    expect(screen.getByText('Release')).toBeInTheDocument();
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('saves individual transactions rule', async function () {
    const rule = {
      condition: {
        inner: [{name: 'event.release', op: 'glob', value: ['1.2.3']}],
        op: 'and',
      },
      id: 0,
      sampleRate: 0.3,
      type: 'transaction',
    };

    const saveMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: TestStubs.Project({
        dynamicSampling: {
          rules: [rule],
          next_id: 41,
        },
      }),
    });

    renderComponent({ruleType: SamplingRuleType.TRANSACTION});

    // Open Modal
    await openSamplingRuleModal(screen.getByText('Add Rule'));
    const dialog = screen.getByRole('dialog');

    // Modal description
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'Select Transactions only within this project which match your conditions. However, If you want to select all Transactions distributed across multiple projects/services, we recommend you add a Distributed Trace rule instead.'
        )
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Distributed Trace'})).toHaveAttribute(
      'href',
      `${SamplingRuleType.TRACE}/`
    );

    // Empty conditions message
    expect(screen.getByText('No conditions added')).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          "if you don't want to add (+) a condition, simply, add a sample rate below"
        )
      )
    ).toBeInTheDocument();

    // Click on 'Add condition'
    userEvent.click(screen.getByText('Add Condition'));

    // Individual Transactions Options
    individualTransactionsConditions.forEach(condition => {
      expect(within(dialog).getByText(getInnerNameLabel(condition))).toBeInTheDocument();
    });

    // Click on the first condition option
    userEvent.click(screen.getAllByText('Release')[0]);

    // Type into release field
    userEvent.paste(screen.getByLabelText('Search or add a release'), '1.2.3');

    // Click on the suggested option
    userEvent.click(screen.getByTestId('1.2.3'));

    // Fill sample rate field
    userEvent.paste(screen.getByPlaceholderText('\u0025'), '30');

    // Click on save button
    userEvent.click(screen.getByLabelText('Save Rule'));

    // Close Modal
    userEvent.click(screen.getByLabelText('Close Modal'));
    await waitForElementToBeRemoved(() =>
      screen.queryByText('Add Individual Transaction Rule')
    );

    expect(saveMock).toHaveBeenLastCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({
        data: {
          dynamicSampling: {
            rules: [rule],
          },
        },
      })
    );
  });

  it('edits the rule', async function () {
    const newRule = {
      condition: {
        inner: [{name: 'trace.release', op: 'glob', value: ['1.2.3']}],
        op: 'and',
      },
      id: 0,
      sampleRate: 0.6,
      type: 'trace',
    };

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: TestStubs.Project({
        dynamicSampling: {
          rules: [
            {
              sampleRate: 0.2,
              type: 'trace',
              condition: {
                op: 'and',
                inner: [
                  {
                    op: 'glob',
                    name: 'trace.release',
                    value: ['1.2.2'],
                  },
                ],
              },
              id: 40,
            },
          ],
          next_id: 41,
        },
      }),
    });

    const saveMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: TestStubs.Project({
        dynamicSampling: {
          rules: [newRule],
          next_id: 42,
        },
      }),
    });

    renderComponent();

    expect(screen.getByText('1.2.2')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();

    await openSamplingRuleModal(screen.getByLabelText('Edit Rule'));

    // Empty conditions message is not displayed
    expect(screen.queryByText('No conditions added')).not.toBeInTheDocument();

    // Type into release field
    userEvent.clear(screen.getByLabelText('Search or add a release'));
    userEvent.paste(screen.getByLabelText('Search or add a release'), '1.2.3');

    // Click on the suggested option
    userEvent.click(await screen.findByText(textWithMarkupMatcher('Add "1.2.3"')));

    // Update sample rate field
    userEvent.clear(screen.getByPlaceholderText('\u0025'));
    userEvent.paste(screen.getByPlaceholderText('\u0025'), '60');

    // Click on save button
    userEvent.click(screen.getByLabelText('Save Rule'));

    // Modal will close
    await waitForElementToBeRemoved(() =>
      screen.queryByText('Edit Distributed Trace Rule')
    );

    expect(saveMock).toHaveBeenLastCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({
        data: {
          dynamicSampling: {
            rules: [newRule],
          },
        },
      })
    );

    // Old values
    expect(screen.queryByText('1.2.2')).not.toBeInTheDocument();
    expect(screen.queryByText('20%')).not.toBeInTheDocument();

    // New values
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('legacy browsers condition', async function () {
    const rule = {
      condition: {
        inner: [
          {
            name: 'event.legacy_browser',
            op: 'custom',
            value: [
              'ie_pre_9',
              'ie9',
              'ie10',
              'ie11',
              'safari_pre_6',
              'opera_pre_15',
              'opera_mini_pre_8',
              'android_pre_4',
            ],
          },
        ],
        op: 'and',
      },
      id: 0,
      sampleRate: 0.2,
      type: 'transaction',
    };

    const saveMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: TestStubs.Project({
        dynamicSampling: {
          rules: [rule],
          next_id: 43,
        },
      }),
    });

    renderComponent({ruleType: SamplingRuleType.TRANSACTION});

    // Open Modal
    await openSamplingRuleModal(screen.getByText('Add Rule'));

    // Click on 'Add condition'
    userEvent.click(screen.getByText('Add Condition'));

    // Select Legacy Browser
    userEvent.click(screen.getByText('Legacy Browser'));

    // Legacy Browsers
    expect(screen.getByText('All browsers')).toBeInTheDocument();

    const legacyBrowsers = Object.keys(LEGACY_BROWSER_LIST);
    for (const legacyBrowser of legacyBrowsers) {
      const {icon, title} = LEGACY_BROWSER_LIST[legacyBrowser];
      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.getAllByTestId(`icon-${icon}`)[0]).toBeInTheDocument();
    }

    expect(screen.getAllByTestId('icon-internet-explorer')).toHaveLength(4);
    expect(screen.getAllByTestId('icon-opera')).toHaveLength(2);
    expect(screen.getByTestId('icon-safari')).toBeInTheDocument();
    expect(screen.getByTestId('icon-android')).toBeInTheDocument();

    const switchButtons = screen.getAllByTestId('switch');
    expect(switchButtons).toHaveLength(legacyBrowsers.length + 1);

    // All browsers are unchecked
    for (const switchButton of switchButtons) {
      expect(switchButton).not.toBeChecked();
    }

    // Click on the switch of 'All browsers' option
    userEvent.click(switchButtons[0]);

    // All browsers are now checked
    for (const switchButton of switchButtons) {
      expect(switchButton).toBeChecked();
    }

    // Fill sample rate field
    userEvent.paste(screen.getByPlaceholderText('\u0025'), '20');

    // Click on save button
    userEvent.click(screen.getByLabelText('Save Rule'));

    // Close Modal
    userEvent.click(screen.getByLabelText('Close Modal'));
    await waitForElementToBeRemoved(() =>
      screen.queryByText('Add Individual Transaction Rule')
    );

    expect(saveMock).toHaveBeenLastCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({
        data: {
          dynamicSampling: {
            rules: [rule],
          },
        },
      })
    );

    // Transaction rules panel is updated
    expect(screen.getByText('Legacy Browser')).toBeInTheDocument();
    for (const legacyBrowser of legacyBrowsers) {
      const {title} = LEGACY_BROWSER_LIST[legacyBrowser];
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('custom tag condition', async function () {
    const rule = {
      condition: {
        inner: [{name: 'event.tags.user', op: 'glob', value: ['david']}],
        op: 'and',
      },
      id: 0,
      sampleRate: 0.15,
      type: 'transaction',
    };

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/user/values/',
      method: 'GET',
      body: [{value: 'david'}],
    });

    const saveMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: TestStubs.Project({
        dynamicSampling: {
          rules: [rule],
          next_id: 43,
        },
      }),
    });

    renderComponent({ruleType: SamplingRuleType.TRANSACTION});

    // Open Modal
    await openSamplingRuleModal(screen.getByText('Add Rule'));

    // Click on 'Add condition'
    userEvent.click(screen.getByText('Add Condition'));

    // Select Custom Tag
    userEvent.click(screen.getByText('Add Custom Tag'));

    // Type into tag field
    userEvent.paste(screen.getByLabelText('Search or add a tag'), 'user');

    // Click on the suggested option
    userEvent.click(screen.getByTestId('user'));

    // Type into tag value field
    userEvent.paste(screen.getByLabelText('Search or add tag values'), 'david');

    // Click on the suggested option
    userEvent.click(screen.getByTestId('david'));

    // Fill sample rate field
    userEvent.paste(screen.getByPlaceholderText('\u0025'), '15');

    // Click on 'Add condition'
    userEvent.click(screen.getByText('Add Condition'));

    // Custom tag condition is added to the conditions dropdown
    expect(screen.getByText('user - Custom')).toBeInTheDocument();

    // Click on save button
    userEvent.click(screen.getByLabelText('Save Rule'));

    // Close Modal
    userEvent.click(screen.getByLabelText('Close Modal'));
    await waitForElementToBeRemoved(() =>
      screen.queryByText('Add Individual Transaction Rule')
    );

    expect(saveMock).toHaveBeenLastCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({
        data: {
          dynamicSampling: {
            rules: [rule],
          },
        },
      })
    );
  });

  it('invalid custom tag condition', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/sentry.key/values/',
      method: 'GET',
      body: [],
    });

    renderComponent({ruleType: SamplingRuleType.TRANSACTION});

    // Open Modal
    await openSamplingRuleModal(screen.getByText('Add Rule'));

    // Click on 'Add condition'
    userEvent.click(screen.getByText('Add Condition'));

    // Select Custom Tag
    userEvent.click(screen.getByText('Add Custom Tag'));

    // Type invalid value into tag field
    userEvent.paste(screen.getByLabelText('Search or add a tag'), 'sentry.*');

    // Dropdown display 'no options' because the tag is invalid
    expect(await screen.findByText('No options')).toBeInTheDocument();

    // Type valid value into tag field
    userEvent.type(screen.getByLabelText('Search or add a tag'), '{backspace}key');

    // Click on the suggested option
    userEvent.click(screen.getByTestId('sentry.key'));

    // Type invalid value into tag value field
    userEvent.paste(screen.getByLabelText('Search or add tag values'), 'invalid\\nvalue');

    // Dropdown display 'no options' because the tag value is invalid
    expect(await screen.findByText('No options')).toBeInTheDocument();

    // Clears tag value field
    userEvent.clear(screen.getByLabelText('Search or add tag values'));

    // Type valid value into tag value field
    userEvent.paste(screen.getByLabelText('Search or add tag values'), 'valid');

    // Click on the suggested option
    userEvent.click(screen.getByTestId('valid'));
  });

  it('does not let you save without permissions', async function () {
    renderComponent({
      orgOptions: {
        features: ['filters-and-sampling'],
        access: [],
      },
    });

    // Open Modal
    await openSamplingRuleModal(screen.getByText('Add Rule'));

    // Click on 'Add condition'
    userEvent.click(screen.getByText('Add Condition'));

    // Click on the condition option
    userEvent.click(screen.getAllByText('Release')[0]);

    // Type into release field
    userEvent.paste(screen.getByLabelText('Search or add a release'), '1.2.3');

    // Click on the suggested option
    userEvent.click(screen.getByTestId('1.2.3'));

    // Fill sample rate field
    userEvent.paste(screen.getByPlaceholderText('\u0025'), '20');

    // Button is still disabled
    expect(screen.getByLabelText('Save Rule')).toBeDisabled();

    // Close Modal
    userEvent.click(screen.getByLabelText('Close Modal'));
    await waitForElementToBeRemoved(() =>
      screen.queryByText('Add Distributed Trace Rule')
    );
  });

  it('does not let you save a distributed trace rule without a condition, if a trace rule without a condition already exists', async function () {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: TestStubs.Project({
        dynamicSampling: {
          rules: [
            {
              sampleRate: 0.2,
              type: 'trace',
              condition: {
                op: 'and',
                inner: [
                  {
                    op: 'glob',
                    name: 'trace.release',
                    value: ['1.2.2'],
                  },
                ],
              },
              id: 40,
            },
            {
              sampleRate: 0.5,
              type: 'trace',
              condition: {
                op: 'and',
                inner: [],
              },
              id: 41,
            },
          ],
          next_id: 42,
        },
      }),
    });

    renderComponent();

    // Open Modal
    await openSamplingRuleModal(screen.getByText('Add Rule'));

    // Empty conditions message
    expect(screen.getByText('No conditions added')).toBeInTheDocument();

    // A hint about an existing 'sample all' rule is displayed
    expect(
      screen.getByText(
        'A rule with no conditions already exists. You can edit that existing rule or add a condition to this rule'
      )
    ).toBeInTheDocument();

    // Adds a sample rate
    userEvent.paste(screen.getByPlaceholderText('\u0025'), '5');

    // Button is still disabled
    expect(screen.getByLabelText('Save Rule')).toBeDisabled();
  });

  it('does not let you save a individual transaction rule without a condition, if a transaction rule without a condition already exists', async function () {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: TestStubs.Project({
        dynamicSampling: {
          rules: [
            {
              condition: {
                inner: [{name: 'event.release', op: 'glob', value: ['1.2.3']}],
                op: 'and',
              },
              id: 0,
              sampleRate: 0.3,
              type: 'transaction',
            },
            {
              condition: {
                inner: [],
                op: 'and',
              },
              id: 1,
              sampleRate: 0.2,
              type: 'transaction',
            },
          ],
          next_id: 2,
        },
      }),
    });

    renderComponent({ruleType: SamplingRuleType.TRANSACTION});

    // Open Modal
    await openSamplingRuleModal(screen.getByText('Add Rule'));

    // Empty conditions message
    expect(screen.getByText('No conditions added')).toBeInTheDocument();

    // A hint about an existing 'sample all' rule is displayed
    expect(
      screen.getByText(
        'A rule with no conditions already exists. You can edit that existing rule or add a condition to this rule'
      )
    ).toBeInTheDocument();

    // Adds a sample rate
    userEvent.paste(screen.getByPlaceholderText('\u0025'), '5');

    // Button is still disabled
    expect(screen.getByLabelText('Save Rule')).toBeDisabled();
  });
});
