import {Fragment} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  fireEvent,
  mountWithTheme,
  screen,
  waitForElementToBeRemoved,
  within,
} from 'sentry-test/reactTestingLibrary';
import {findByTextContent} from 'sentry-test/utils';

import GlobalModal from 'app/components/globalModal';
import FiltersAndSampling from 'app/views/settings/project/filtersAndSampling';
import {
  DYNAMIC_SAMPLING_DOC_LINK,
  LEGACY_BROWSER_LIST,
} from 'app/views/settings/project/filtersAndSampling/utils';

describe('Filters and Sampling', function () {
  const commonConditionCategories = [
    'Release',
    'Environment',
    'User Id',
    'User Segment',
    'Browser Extensions',
    'Localhost',
    'Legacy Browser',
    'Web Crawlers',
    'IP Address',
    'Content Security Policy',
    'Error Message',
    'Transaction',
  ];

  MockApiClient.addMockResponse({
    url: '/projects/org-slug/project-slug/',
    method: 'GET',
    body: TestStubs.Project(),
  });

  function renderComponent(withModal = true) {
    const {organization, project} = initializeOrg({
      organization: {features: ['filters-and-sampling']},
    } as Parameters<typeof initializeOrg>[0]);

    return mountWithTheme(
      <Fragment>
        {withModal && <GlobalModal />}
        <FiltersAndSampling organization={organization} project={project} />
      </Fragment>
    );
  }

  async function renderModal(actionElement: HTMLElement, takeScreenshot = false) {
    // Open Modal
    fireEvent.click(actionElement);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    if (takeScreenshot) {
      expect(dialog).toSnapshot();
    }
  }

  describe('renders', function () {
    it('empty', async function () {
      const {container} = renderComponent(false);

      // Title
      expect(screen.getByText('Filters & Sampling')).toBeInTheDocument();

      // Error rules container
      expect(
        await findByTextContent(
          screen,
          'Manage the inbound data you want to store. To change the sampling rate or rate limits, update your SDK configuration. The rules added below will apply on top of your SDK configuration. Any new rule may take a few minutes to propagate.'
        )
      ).toBeTruthy();

      expect(
        screen.getByRole('link', {
          name: 'update your SDK configuration',
        })
      ).toHaveAttribute('href', DYNAMIC_SAMPLING_DOC_LINK);

      expect(screen.getByText('There are no error rules to display')).toBeInTheDocument();
      expect(screen.getByText('Add error rule')).toBeInTheDocument();

      // Transaction traces and individual transactions rules container
      expect(
        screen.getByText(
          'Rules for traces should precede rules for individual transactions.'
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText('There are no transaction rules to display')
      ).toBeInTheDocument();
      expect(screen.getByText('Add transaction rule')).toBeInTheDocument();

      const readDocsButtonLinks = screen.getAllByRole('button', {
        name: 'Read the docs',
      });
      expect(readDocsButtonLinks).toHaveLength(2);

      for (const readDocsButtonLink of readDocsButtonLinks) {
        expect(readDocsButtonLink).toHaveAttribute('href', DYNAMIC_SAMPLING_DOC_LINK);
      }

      expect(screen.getAllByText('Type')).toHaveLength(2);
      expect(screen.getAllByText('Conditions')).toHaveLength(2);
      expect(screen.getAllByText('Rate')).toHaveLength(2);

      expect(container).toSnapshot();
    });

    it('with rules', async function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'GET',
        body: TestStubs.Project({
          dynamicSampling: {
            rules: [
              {
                sampleRate: 0.2,
                type: 'error',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'event.release',
                      value: ['1.2.3'],
                    },
                  ],
                },
                id: 39,
              },
              {
                sampleRate: 0.2,
                type: 'trace',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'trace.release',
                      value: ['1.2.3'],
                    },
                  ],
                },
                id: 40,
              },
              {
                sampleRate: 0.2,
                type: 'transaction',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'custom',
                      name: 'event.legacy_browser',
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
                },
                id: 42,
              },
            ],
            next_id: 43,
          },
        }),
      });

      const {container} = renderComponent(false);

      // Title
      expect(screen.getByText('Filters & Sampling')).toBeInTheDocument();

      // Error rules container
      expect(
        await findByTextContent(
          screen,
          'Manage the inbound data you want to store. To change the sampling rate or rate limits, update your SDK configuration. The rules added below will apply on top of your SDK configuration. Any new rule may take a few minutes to propagate.'
        )
      ).toBeTruthy();

      expect(
        screen.getByRole('link', {
          name: 'update your SDK configuration',
        })
      ).toHaveAttribute('href', DYNAMIC_SAMPLING_DOC_LINK);

      expect(
        screen.queryByText('There are no error rules to display')
      ).not.toBeInTheDocument();
      expect(screen.getByText('Errors only')).toBeInTheDocument();

      expect(screen.getByText('Add error rule')).toBeInTheDocument();

      // Transaction traces and individual transactions rules container
      expect(
        screen.getByText(
          'Rules for traces should precede rules for individual transactions.'
        )
      ).toBeInTheDocument();

      expect(
        screen.queryByText('There are no transaction rules to display')
      ).not.toBeInTheDocument();
      const transactionTraceRules = screen.getByText('Transaction traces');
      expect(transactionTraceRules).toBeInTheDocument();

      const individualTransactionRules = screen.getByText('Individual transactions');
      expect(individualTransactionRules).toBeInTheDocument();

      expect(screen.getByText('Add transaction rule')).toBeInTheDocument();

      const readDocsButtonLinks = screen.getAllByRole('button', {
        name: 'Read the docs',
      });
      expect(readDocsButtonLinks).toHaveLength(2);

      for (const readDocsButtonLink of readDocsButtonLinks) {
        expect(readDocsButtonLink).toHaveAttribute('href', DYNAMIC_SAMPLING_DOC_LINK);
      }

      expect(screen.getAllByText('Type')).toHaveLength(2);
      expect(screen.getAllByText('Conditions')).toHaveLength(2);
      expect(screen.getAllByText('Rate')).toHaveLength(2);

      expect(container).toSnapshot();
    });
  });

  describe('edit rules', function () {
    it('error rule', async function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'GET',
        body: TestStubs.Project({
          dynamicSampling: {
            rules: [
              {
                sampleRate: 0.1,
                type: 'error',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'event.release',
                      value: ['1*'],
                    },
                  ],
                },
                id: 39,
              },
              {
                sampleRate: 0.2,
                type: 'trace',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'trace.release',
                      value: ['1.2.3'],
                    },
                  ],
                },
                id: 40,
              },
            ],
            next_id: 43,
          },
        }),
      });

      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'PUT',
        body: TestStubs.Project({
          dynamicSampling: {
            rules: [
              {
                sampleRate: 0.5,
                type: 'error',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'event.release',
                      value: ['[I3].[0-9]'],
                    },
                  ],
                },
                id: 44,
              },
              {
                sampleRate: 0.2,
                type: 'trace',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'trace.release',
                      value: ['1.2.3'],
                    },
                  ],
                },
                id: 40,
              },
            ],
            next_id: 43,
          },
        }),
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/release/values/',
        method: 'GET',
        body: [{value: '[I3].[0-9]'}],
      });

      renderComponent();

      // Error rules container
      expect(
        screen.queryByText('There are no error rules to display')
      ).not.toBeInTheDocument();
      expect(screen.getByText('Errors only')).toBeInTheDocument();

      // Transaction traces and individual transactions rules container
      expect(
        screen.queryByText('There are no transaction rules to display')
      ).not.toBeInTheDocument();
      const transactionTraceRules = screen.getByText('Transaction traces');
      expect(transactionTraceRules).toBeInTheDocument();

      const editRuleButtons = screen.getAllByLabelText('Edit Rule');
      expect(editRuleButtons).toHaveLength(2);

      // Open rule modal - edit error rule
      await renderModal(editRuleButtons[0]);

      // Modal content
      expect(screen.getByText('Edit Error Sampling Rule')).toBeInTheDocument();
      expect(screen.queryByText('Tracing')).not.toBeInTheDocument();

      // Release Field
      await screen.findByTestId('autocomplete-release');
      const releaseField = screen.getByTestId('autocomplete-release');
      expect(releaseField).toBeInTheDocument();

      // Release field is not empty
      const releaseFieldValues = screen.getByTestId('multivalue');
      expect(releaseFieldValues).toBeInTheDocument();
      expect(releaseFieldValues).toHaveTextContent('1*');

      // Button is enabled - meaning the form is valid
      const saveRuleButton = screen.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeInTheDocument();
      expect(saveRuleButton).toBeEnabled();

      // Sample rate field
      const sampleRateField = screen.getByPlaceholderText('\u0025');
      expect(sampleRateField).toBeInTheDocument();

      // Sample rate is not empty
      expect(sampleRateField).toHaveValue(10);

      // Clear release field
      fireEvent.keyDown(screen.getByLabelText('Search or add a release'), {
        key: 'Backspace',
      });

      // Release field is now empty
      const newReleaseFieldValues = screen.queryByTestId('multivalue');
      expect(newReleaseFieldValues).not.toBeInTheDocument();

      expect(screen.getByRole('button', {name: 'Save Rule'})).toBeDisabled();

      // Type into realease field
      fireEvent.change(screen.getByLabelText('Search or add a release'), {
        target: {value: '[I3].[0-9]'},
      });

      // Autocomplete suggests options
      const autocompleteOptions = screen.getByTestId('option');
      expect(autocompleteOptions).toBeInTheDocument();
      expect(autocompleteOptions).toHaveTextContent('[I3].[0-9]');

      // Click on the suggested option
      fireEvent.click(autocompleteOptions);

      expect(screen.getByRole('button', {name: 'Save Rule'})).toBeEnabled();

      // Clear sample rate field
      fireEvent.change(sampleRateField, {target: {value: null}});

      expect(screen.getByRole('button', {name: 'Save Rule'})).toBeDisabled();

      // Update sample rate field
      fireEvent.change(sampleRateField, {target: {value: 50}});

      // Save button is now enabled
      const saveRuleButtonEnabled = screen.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButtonEnabled).toBeEnabled();

      // Click on save button
      fireEvent.click(saveRuleButtonEnabled);

      // Modal will close
      await waitForElementToBeRemoved(() => screen.getByText('Edit Error Sampling Rule'));

      // Error rules panel is updated
      expect(screen.getByText('Errors only')).toBeInTheDocument();

      expect(screen.getAllByText('Release')).toHaveLength(2);

      // Old values
      expect(screen.queryByText('1*')).not.toBeInTheDocument();
      expect(screen.queryByText('10%')).not.toBeInTheDocument();

      // New values
      expect(screen.getByText('[I3].[0-9]')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('transaction trace rule', async function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'GET',
        body: TestStubs.Project({
          dynamicSampling: {
            rules: [
              {
                sampleRate: 0.1,
                type: 'error',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'event.release',
                      value: ['1*'],
                    },
                  ],
                },
                id: 39,
              },
              {
                sampleRate: 0.2,
                type: 'trace',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'trace.release',
                      value: ['1.2.3'],
                    },
                  ],
                },
                id: 40,
              },
            ],
            next_id: 43,
          },
        }),
      });

      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'PUT',
        body: TestStubs.Project({
          dynamicSampling: {
            rules: [
              {
                sampleRate: 0.1,
                type: 'error',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'event.release',
                      value: ['1*'],
                    },
                  ],
                },
                id: 44,
              },
              {
                sampleRate: 0.6,
                type: 'trace',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'trace.release',
                      value: ['[0-9]'],
                    },
                  ],
                },
                id: 45,
              },
            ],
            next_id: 43,
          },
        }),
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/release/values/',
        method: 'GET',
        body: [{value: '[0-9]'}],
      });

      renderComponent();

      // Error rules container
      expect(
        screen.queryByText('There are no error rules to display')
      ).not.toBeInTheDocument();
      expect(screen.getByText('Errors only')).toBeInTheDocument();

      // Transaction traces and individual transactions rules container
      expect(
        screen.queryByText('There are no transaction rules to display')
      ).not.toBeInTheDocument();
      const transactionTraceRules = screen.getByText('Transaction traces');
      expect(transactionTraceRules).toBeInTheDocument();

      const editRuleButtons = screen.getAllByLabelText('Edit Rule');
      expect(editRuleButtons).toHaveLength(2);

      // Open rule modal - edit transaction rule
      await renderModal(editRuleButtons[1]);

      // Modal content
      expect(screen.getByText('Edit Transaction Sampling Rule')).toBeInTheDocument();
      expect(screen.getByText('Tracing')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeChecked();

      // Release Field
      const releaseField = await screen.findByTestId('autocomplete-release');
      expect(releaseField).toBeInTheDocument();

      // Release field is not empty
      const releaseFieldValues = screen.getByTestId('multivalue');
      expect(releaseFieldValues).toBeInTheDocument();
      expect(releaseFieldValues).toHaveTextContent('1.2.3');

      // Button is enabled - meaning the form is valid
      const saveRuleButton = screen.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeInTheDocument();
      expect(saveRuleButton).toBeEnabled();

      // Sample rate field
      const sampleRateField = screen.getByPlaceholderText('\u0025');
      expect(sampleRateField).toBeInTheDocument();

      // Sample rate is not empty
      expect(sampleRateField).toHaveValue(20);

      // Clear release field
      fireEvent.keyDown(screen.getByLabelText('Search or add a release'), {
        key: 'Backspace',
      });

      // Release field is now empty
      const newReleaseFieldValues = screen.queryByTestId('multivalue');
      expect(newReleaseFieldValues).not.toBeInTheDocument();

      expect(screen.getByRole('button', {name: 'Save Rule'})).toBeDisabled();

      // Type into realease field
      fireEvent.change(screen.getByLabelText('Search or add a release'), {
        target: {value: '[0-9]'},
      });

      // Autocomplete suggests options
      const autocompleteOptions = screen.getByTestId('option');
      expect(autocompleteOptions).toBeInTheDocument();
      expect(autocompleteOptions).toHaveTextContent('[0-9]');

      // Click on the suggested option
      fireEvent.click(autocompleteOptions);

      expect(screen.getByRole('button', {name: 'Save Rule'})).toBeEnabled();

      // Clear sample rate field
      fireEvent.change(sampleRateField, {target: {value: null}});

      expect(screen.getByRole('button', {name: 'Save Rule'})).toBeDisabled();

      // Update sample rate field
      fireEvent.change(sampleRateField, {target: {value: 60}});

      // Save button is now enabled
      const saveRuleButtonEnabled = screen.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButtonEnabled).toBeEnabled();

      // Click on save button
      fireEvent.click(saveRuleButtonEnabled);

      // Modal will close
      await waitForElementToBeRemoved(() =>
        screen.getByText('Edit Transaction Sampling Rule')
      );

      // Error rules panel is updated
      expect(screen.getByText('Errors only')).toBeInTheDocument();

      expect(screen.getByText('Transaction traces')).toBeInTheDocument();
      expect(screen.getAllByText('Release')).toHaveLength(2);

      // Old values
      expect(screen.queryByText('1.2.3')).not.toBeInTheDocument();
      expect(screen.queryByText('20%')).not.toBeInTheDocument();

      // New values
      expect(screen.getByText('[0-9]')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('individual transaction rule', async function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'GET',
        body: TestStubs.Project({
          dynamicSampling: {
            rules: [
              {
                sampleRate: 0.1,
                type: 'error',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'event.release',
                      value: ['1*'],
                    },
                  ],
                },
                id: 39,
              },
              {
                sampleRate: 0.2,
                type: 'transaction',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'event.release',
                      value: ['1.2.3'],
                    },
                  ],
                },
                id: 40,
              },
            ],
            next_id: 43,
          },
        }),
      });

      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'PUT',
        body: TestStubs.Project({
          dynamicSampling: {
            rules: [
              {
                sampleRate: 0.1,
                type: 'error',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'event.release',
                      value: ['1*'],
                    },
                  ],
                },
                id: 44,
              },
              {
                sampleRate: 0.6,
                type: 'transaction',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'event.release',
                      value: ['[0-9]'],
                    },
                  ],
                },
                id: 45,
              },
            ],
            next_id: 43,
          },
        }),
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/release/values/',
        method: 'GET',
        body: [{value: '[0-9]'}],
      });

      renderComponent();

      // Error rules container
      expect(
        screen.queryByText('There are no error rules to display')
      ).not.toBeInTheDocument();
      expect(screen.getByText('Errors only')).toBeInTheDocument();

      // Transaction traces and individual transactions rules container
      expect(
        screen.queryByText('There are no transaction rules to display')
      ).not.toBeInTheDocument();
      const transactionTraceRules = screen.getByText('Individual transactions');
      expect(transactionTraceRules).toBeInTheDocument();

      const editRuleButtons = screen.getAllByLabelText('Edit Rule');
      expect(editRuleButtons).toHaveLength(2);

      // Open rule modal - edit transaction rule
      await renderModal(editRuleButtons[1]);

      // Modal content
      expect(screen.getByText('Edit Transaction Sampling Rule')).toBeInTheDocument();
      expect(screen.getByText('Tracing')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).not.toBeChecked();

      // Release Field
      await screen.findByTestId('autocomplete-release');
      const releaseField = screen.getByTestId('autocomplete-release');
      expect(releaseField).toBeInTheDocument();

      // Release field is not empty
      const releaseFieldValues = screen.getByTestId('multivalue');
      expect(releaseFieldValues).toBeInTheDocument();

      // Button is enabled - meaning the form is valid
      const saveRuleButton = screen.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeInTheDocument();
      expect(saveRuleButton).toBeEnabled();

      // Sample rate field
      const sampleRateField = screen.getByPlaceholderText('\u0025');
      expect(sampleRateField).toBeInTheDocument();

      // Sample rate is not empty
      expect(sampleRateField).toHaveValue(20);

      // Clear release field
      fireEvent.keyDown(screen.getByLabelText('Search or add a release'), {
        key: 'Backspace',
      });

      // Release field is now empty
      const newReleaseFieldValues = screen.queryByTestId('multivalue');
      expect(newReleaseFieldValues).not.toBeInTheDocument();

      expect(screen.getByRole('button', {name: 'Save Rule'})).toBeDisabled();

      // Type into realease field
      fireEvent.change(screen.getByLabelText('Search or add a release'), {
        target: {value: '[0-9]'},
      });

      // Autocomplete suggests options
      const autocompleteOptions = screen.getByTestId('option');
      expect(autocompleteOptions).toBeInTheDocument();
      expect(autocompleteOptions).toHaveTextContent('[0-9]');

      // Click on the suggested option
      fireEvent.click(autocompleteOptions);

      expect(screen.getByRole('button', {name: 'Save Rule'})).toBeEnabled();

      // Clear sample rate field
      fireEvent.change(sampleRateField, {target: {value: null}});

      expect(screen.getByRole('button', {name: 'Save Rule'})).toBeDisabled();

      // Update sample rate field
      fireEvent.change(sampleRateField, {target: {value: 60}});

      // Save button is now enabled
      const saveRuleButtonEnabled = screen.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButtonEnabled).toBeEnabled();

      // Click on save button
      fireEvent.click(saveRuleButtonEnabled);

      // Modal will close
      await waitForElementToBeRemoved(() =>
        screen.getByText('Edit Transaction Sampling Rule')
      );

      // Error rules panel is updated
      expect(screen.getByText('Errors only')).toBeInTheDocument();

      expect(screen.getByText('Individual transactions')).toBeInTheDocument();
      expect(screen.getAllByText('Release')).toHaveLength(2);

      // Old values
      expect(screen.queryByText('1.2.3')).not.toBeInTheDocument();
      expect(screen.queryByText('20%')).not.toBeInTheDocument();

      // New values
      expect(screen.getByText('[0-9]')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });
  });

  describe('delete rules', function () {
    it('error rule', async function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'GET',
        body: TestStubs.Project({
          dynamicSampling: {
            rules: [
              {
                sampleRate: 0.2,
                type: 'error',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'event.release',
                      value: ['1.2.3'],
                    },
                  ],
                },
                id: 39,
              },
              {
                sampleRate: 0.2,
                type: 'trace',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'trace.release',
                      value: ['1.2.3'],
                    },
                  ],
                },
                id: 40,
              },
            ],
            next_id: 43,
          },
        }),
      });

      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'PUT',
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
                      value: ['1.2.3'],
                    },
                  ],
                },
                id: 40,
              },
            ],
            next_id: 43,
          },
        }),
      });

      renderComponent();

      // Error rules container
      expect(
        screen.queryByText('There are no error rules to display')
      ).not.toBeInTheDocument();
      expect(screen.getByText('Errors only')).toBeInTheDocument();

      // Transaction traces and individual transactions rules container
      expect(
        screen.queryByText('There are no transaction rules to display')
      ).not.toBeInTheDocument();
      const transactionTraceRules = screen.getByText('Transaction traces');
      expect(transactionTraceRules).toBeInTheDocument();

      const deleteRuleButtons = screen.getAllByLabelText('Delete Rule');
      expect(deleteRuleButtons).toHaveLength(2);

      // Open deletion confirmation modal - delete error rule
      await renderModal(deleteRuleButtons[0]);

      expect(
        screen.getByText('Are you sure you wish to delete this dynamic sampling rule?')
      ).toBeInTheDocument();

      expect(screen.getByText('Confirm')).toBeInTheDocument();

      // Confirm deletion
      fireEvent.click(screen.getByText('Confirm'));

      // Confirmation modal will close
      await waitForElementToBeRemoved(() =>
        screen.getByText('Are you sure you wish to delete this dynamic sampling rule?')
      );

      // Error rules panel is updated
      expect(screen.getByText('There are no error rules to display')).toBeInTheDocument();

      // There is still one transaction rule
      expect(transactionTraceRules).toBeInTheDocument();
    });
  });

  describe('error rule modal', function () {
    it('renders modal', async function () {
      renderComponent();

      // Open Modal
      await renderModal(screen.getByText('Add error rule'), true);

      // Modal content
      expect(screen.getByText('Add Error Sampling Rule')).toBeInTheDocument();
      expect(screen.queryByText('Tracing')).not.toBeInTheDocument();
      expect(
        within(screen.getByRole('dialog')).getByText('Conditions')
      ).toBeInTheDocument();
      expect(screen.getByText('Add Condition')).toBeInTheDocument();
      expect(screen.getByText('Apply sampling rate to all errors')).toBeInTheDocument();
      expect(screen.getByText('Sampling Rate \u0025')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('\u0025')).toHaveValue(null);
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
      const saveRuleButton = screen.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeInTheDocument();
      expect(saveRuleButton).toBeDisabled();

      // Close Modal
      fireEvent.click(screen.getByLabelText('Close Modal'));
      await waitForElementToBeRemoved(() => screen.getByText('Add Error Sampling Rule'));
    });

    it('condition options', async function () {
      renderComponent();

      // Open Modal
      await renderModal(screen.getByText('Add error rule'));

      // Click on 'Add condition'
      fireEvent.click(screen.getByText('Add Condition'));

      // Autocomplete
      expect(await screen.findByTestId('autocomplete-list')).toBeInTheDocument();

      // Condition Options
      const conditionOptions = within(
        await screen.findByTestId('autocomplete-list')
      ).getAllByRole('presentation');

      expect(conditionOptions).toHaveLength(commonConditionCategories.length);

      for (const conditionOptionIndex in conditionOptions) {
        expect(conditionOptions[conditionOptionIndex]).toHaveTextContent(
          commonConditionCategories[conditionOptionIndex]
        );
      }

      // Close Modal
      fireEvent.click(screen.getByLabelText('Close Modal'));
      await waitForElementToBeRemoved(() => screen.getByText('Add Error Sampling Rule'));
    });

    it('save rule', async function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'PUT',
        body: TestStubs.Project({
          dynamicSampling: {
            rules: [
              {
                sampleRate: 0.2,
                type: 'error',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'event.release',
                      value: ['1.2.3'],
                    },
                  ],
                },
                id: 39,
              },
            ],
            next_id: 40,
          },
        }),
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/release/values/',
        method: 'GET',
        body: [{value: '1.2.3'}],
      });

      renderComponent();

      // Open Modal
      await renderModal(screen.getByText('Add error rule'));

      // Click on 'Add condition'
      fireEvent.click(screen.getByText('Add Condition'));

      // Autocomplete
      const autoCompleteList = await screen.findByTestId('autocomplete-list');
      expect(autoCompleteList).toBeInTheDocument();

      // Condition Options
      const conditionOptions = within(autoCompleteList).getAllByRole('presentation');

      // Click on the first condition option
      fireEvent.click(conditionOptions[0]);

      // Release Field
      await screen.findByTestId('autocomplete-release');
      const releaseField = screen.getByTestId('autocomplete-release');
      expect(releaseField).toBeInTheDocument();

      // Release field is empty
      const releaseFieldValues = screen.queryByTestId('multivalue');
      expect(releaseFieldValues).not.toBeInTheDocument();

      // Type into realease field
      fireEvent.change(screen.getByLabelText('Search or add a release'), {
        target: {value: '1.2.3'},
      });

      // Autocomplete suggests options
      const autocompleteOptions = screen.getByTestId('option');
      expect(autocompleteOptions).toBeInTheDocument();
      expect(autocompleteOptions).toHaveTextContent('1.2.3');

      // Click on the suggested option
      fireEvent.click(autocompleteOptions);

      // Button is still disabled
      const saveRuleButton = screen.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeInTheDocument();
      expect(saveRuleButton).toBeDisabled();

      // Fill sample rate field
      const sampleRateField = screen.getByPlaceholderText('\u0025');
      expect(sampleRateField).toBeInTheDocument();
      fireEvent.change(sampleRateField, {target: {value: 20}});

      // Save button is now enabled
      const saveRuleButtonEnabled = screen.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButtonEnabled).toBeEnabled();

      // Click on save button
      fireEvent.click(saveRuleButtonEnabled);

      // Modal will close
      await waitForElementToBeRemoved(() => screen.getByText('Add Error Sampling Rule'));

      // Error rules panel is updated
      expect(
        screen.queryByText('There are no error rules to display')
      ).not.toBeInTheDocument();
      expect(screen.getByText('Errors only')).toBeInTheDocument();
      expect(screen.getByText('Release')).toBeInTheDocument();
      expect(screen.getByText('1.2.3')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();
    });
  });

  describe('transaction rule modal', function () {
    const conditionTracingCategories = [
      'Release',
      'Environment',
      'User Id',
      'User Segment',
      'Transaction',
    ];

    it('renders modal', async function () {
      renderComponent();

      // Open Modal
      await renderModal(screen.getByText('Add transaction rule'), true);

      // Modal content
      expect(screen.getByText('Add Transaction Sampling Rule')).toBeInTheDocument();
      expect(screen.getByText('Tracing')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeChecked();
      expect(
        await findByTextContent(
          screen,
          'Include all related transactions by trace ID. This can span across multiple projects. All related errors will remain. Learn more about tracing.'
        )
      ).toBeTruthy();
      expect(
        screen.getByRole('link', {
          name: 'Learn more about tracing',
        })
      ).toHaveAttribute('href', DYNAMIC_SAMPLING_DOC_LINK);
      expect(
        within(screen.getByRole('dialog')).getByText('Conditions')
      ).toBeInTheDocument();
      expect(screen.getByText('Add Condition')).toBeInTheDocument();
      expect(
        screen.getByText('Apply sampling rate to all transactions')
      ).toBeInTheDocument();
      expect(screen.getByText('Sampling Rate \u0025')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('\u0025')).toHaveValue(null);
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
      const saveRuleButton = screen.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeInTheDocument();
      expect(saveRuleButton).toBeDisabled();

      // Close Modal
      fireEvent.click(screen.getByLabelText('Close Modal'));
      await waitForElementToBeRemoved(() =>
        screen.getByText('Add Transaction Sampling Rule')
      );
    });

    it('condition options', async function () {
      renderComponent();

      // Open Modal
      await renderModal(screen.getByText('Add transaction rule'));

      // Click on 'Add condition'
      fireEvent.click(screen.getByText('Add Condition'));

      // Autocomplete
      const autoCompleteList = await screen.findByTestId('autocomplete-list');
      expect(autoCompleteList).toBeInTheDocument();

      // Trancing Condition Options
      const conditionTracingOptions =
        within(autoCompleteList).getAllByRole('presentation');
      expect(conditionTracingOptions).toHaveLength(conditionTracingCategories.length);

      for (const conditionTracingOptionIndex in conditionTracingOptions) {
        expect(conditionTracingOptions[conditionTracingOptionIndex]).toHaveTextContent(
          conditionTracingCategories[conditionTracingOptionIndex]
        );
      }

      // Unchecked tracing checkbox
      fireEvent.click(screen.getByRole('checkbox'));

      // Click on 'Add condition'
      fireEvent.click(screen.getByText('Add Condition'));

      // No Tracing Condition Options
      const conditionOptions = within(autoCompleteList).getAllByRole('presentation');
      expect(conditionOptions).toHaveLength(commonConditionCategories.length);

      for (const conditionOptionIndex in conditionOptions) {
        expect(conditionOptions[conditionOptionIndex]).toHaveTextContent(
          commonConditionCategories[conditionOptionIndex]
        );
      }

      // Close Modal
      fireEvent.click(screen.getByLabelText('Close Modal'));
      await waitForElementToBeRemoved(() =>
        screen.getByText('Add Transaction Sampling Rule')
      );
    });

    describe('save rule', function () {
      it('transaction trace', async function () {
        MockApiClient.addMockResponse({
          url: '/projects/org-slug/project-slug/',
          method: 'PUT',
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
                        value: ['1.2.3'],
                      },
                    ],
                  },
                  id: 40,
                },
              ],
              next_id: 40,
            },
          }),
        });

        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/tags/release/values/',
          method: 'GET',
          body: [{value: '1.2.3'}],
        });

        renderComponent();

        // Open Modal
        await renderModal(screen.getByText('Add transaction rule'));

        // Checked tracing checkbox
        expect(screen.getByRole('checkbox')).toBeChecked();

        // Click on 'Add condition'
        fireEvent.click(screen.getByText('Add Condition'));

        // Autocomplete
        const autoCompleteList = await screen.findByTestId('autocomplete-list');
        expect(autoCompleteList).toBeInTheDocument();

        // Condition Options
        const conditionOptions = within(autoCompleteList).getAllByRole('presentation');

        // Click on the first condition option
        fireEvent.click(conditionOptions[0]);

        // Release Field
        await screen.findByTestId('autocomplete-release');
        const releaseField = screen.getByTestId('autocomplete-release');
        expect(releaseField).toBeInTheDocument();

        // Release field is empty
        const releaseFieldValues = screen.queryByTestId('multivalue');
        expect(releaseFieldValues).not.toBeInTheDocument();

        // Type into realease field
        fireEvent.change(screen.getByLabelText('Search or add a release'), {
          target: {value: '1.2.3'},
        });

        // Autocomplete suggests options
        const autocompleteOptions = screen.getByTestId('option');
        expect(autocompleteOptions).toBeInTheDocument();
        expect(autocompleteOptions).toHaveTextContent('1.2.3');

        // Click on the suggested option
        fireEvent.click(autocompleteOptions);

        // Button is still disabled
        const saveRuleButton = screen.getByRole('button', {name: 'Save Rule'});
        expect(saveRuleButton).toBeInTheDocument();
        expect(saveRuleButton).toBeDisabled();

        // Fill sample rate field
        const sampleRateField = screen.getByPlaceholderText('\u0025');
        expect(sampleRateField).toBeInTheDocument();
        fireEvent.change(sampleRateField, {target: {value: 20}});

        // Save button is now enabled
        const saveRuleButtonEnabled = screen.getByRole('button', {name: 'Save Rule'});
        expect(saveRuleButtonEnabled).toBeEnabled();

        // Click on save button
        fireEvent.click(saveRuleButtonEnabled);

        // Modal will close
        await waitForElementToBeRemoved(() =>
          screen.getByText('Add Transaction Sampling Rule')
        );

        // Transaction rules panel is updated
        expect(
          screen.queryByText('There are no transaction rules to display')
        ).not.toBeInTheDocument();
        const transactionTraceRules = screen.getByText('Transaction traces');
        expect(transactionTraceRules).toBeInTheDocument();
        expect(screen.getByText('Release')).toBeInTheDocument();
        expect(screen.getByText('1.2.3')).toBeInTheDocument();
        expect(screen.getByText('20%')).toBeInTheDocument();
      });

      describe('individual transaction', function () {
        it('release', async function () {
          MockApiClient.addMockResponse({
            url: '/projects/org-slug/project-slug/',
            method: 'PUT',
            body: TestStubs.Project({
              dynamicSampling: {
                rules: [
                  {
                    sampleRate: 0.2,
                    type: 'transaction',
                    condition: {
                      op: 'and',
                      inner: [
                        {
                          op: 'glob',
                          name: 'event.release',
                          value: ['1.2.3'],
                        },
                      ],
                    },
                    id: 41,
                  },
                ],
                next_id: 40,
              },
            }),
          });

          MockApiClient.addMockResponse({
            url: '/organizations/org-slug/tags/release/values/',
            method: 'GET',
            body: [{value: '1.2.3'}],
          });

          renderComponent();

          // Open Modal
          await renderModal(screen.getByText('Add transaction rule'));

          // Unchecked tracing checkbox
          fireEvent.click(screen.getByRole('checkbox'));

          // Click on 'Add condition'
          fireEvent.click(screen.getByText('Add Condition'));

          // Autocomplete
          const autoCompleteList = await screen.findByTestId('autocomplete-list');
          expect(autoCompleteList).toBeInTheDocument();

          // Condition Options
          const conditionOptions = within(autoCompleteList).getAllByRole('presentation');

          // Click on the first condition option
          fireEvent.click(conditionOptions[0]);

          // Release Field
          await screen.findByTestId('autocomplete-release');
          const releaseField = screen.getByTestId('autocomplete-release');
          expect(releaseField).toBeInTheDocument();

          // Release field is empty
          const releaseFieldValues = screen.queryByTestId('multivalue');
          expect(releaseFieldValues).not.toBeInTheDocument();

          // Type into realease field
          fireEvent.change(screen.getByLabelText('Search or add a release'), {
            target: {value: '1.2.3'},
          });

          // Autocomplete suggests options
          const autocompleteOptions = screen.getByTestId('option');
          expect(autocompleteOptions).toBeInTheDocument();
          expect(autocompleteOptions).toHaveTextContent('1.2.3');

          // Click on the suggested option
          fireEvent.click(autocompleteOptions);

          // Button is still disabled
          const saveRuleButton = screen.getByRole('button', {name: 'Save Rule'});
          expect(saveRuleButton).toBeInTheDocument();
          expect(saveRuleButton).toBeDisabled();

          // Fill sample rate field
          const sampleRateField = screen.getByPlaceholderText('\u0025');
          expect(sampleRateField).toBeInTheDocument();
          fireEvent.change(sampleRateField, {target: {value: 20}});

          // Save button is now enabled
          const saveRuleButtonEnabled = screen.getByRole('button', {name: 'Save Rule'});
          expect(saveRuleButtonEnabled).toBeEnabled();

          // Click on save button
          fireEvent.click(saveRuleButtonEnabled);

          // Modal will close
          await waitForElementToBeRemoved(() =>
            screen.getByText('Add Transaction Sampling Rule')
          );

          // Transaction rules panel is updated
          expect(
            screen.queryByText('There are no transaction rules to display')
          ).not.toBeInTheDocument();
          const individualTransactionRules = screen.getByText('Individual transactions');
          expect(individualTransactionRules).toBeInTheDocument();
          expect(screen.getByText('Release')).toBeInTheDocument();
          expect(screen.getByText('1.2.3')).toBeInTheDocument();
          expect(screen.getByText('20%')).toBeInTheDocument();
        });

        it('legacy browser', async function () {
          MockApiClient.addMockResponse({
            url: '/projects/org-slug/project-slug/',
            method: 'PUT',
            body: TestStubs.Project({
              dynamicSampling: {
                rules: [
                  {
                    sampleRate: 0.2,
                    type: 'transaction',
                    condition: {
                      op: 'and',
                      inner: [
                        {
                          op: 'custom',
                          name: 'event.legacy_browser',
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
                    },
                    id: 42,
                  },
                ],
                next_id: 40,
              },
            }),
          });

          renderComponent();

          // Open Modal
          await renderModal(screen.getByText('Add transaction rule'));
          const checkedCheckbox = screen.getByRole('checkbox');

          // Checked tracing checkbox
          expect(checkedCheckbox).toBeChecked();

          // Uncheck tracing checkbox
          fireEvent.click(checkedCheckbox);

          // Unched tracing checkbox
          expect(checkedCheckbox).not.toBeChecked();

          // Click on 'Add condition'
          fireEvent.click(screen.getByText('Add Condition'));

          // Autocomplete
          const autoCompleteList = await screen.findByTestId('autocomplete-list');
          expect(autoCompleteList).toBeInTheDocument();

          // Condition Options
          const conditionOptions = within(autoCompleteList).getAllByRole('presentation');

          // Click on the seventh condition option
          fireEvent.click(conditionOptions[6]);

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
          fireEvent.click(switchButtons[0]);

          // All browsers are now checked
          for (const switchButton of switchButtons) {
            expect(switchButton).toBeChecked();
          }

          // Button is still disabled
          const saveRuleButton = screen.getByRole('button', {name: 'Save Rule'});
          expect(saveRuleButton).toBeInTheDocument();
          expect(saveRuleButton).toBeDisabled();

          // Fill sample rate field
          const sampleRateField = screen.getByPlaceholderText('\u0025');
          expect(sampleRateField).toBeInTheDocument();
          fireEvent.change(sampleRateField, {target: {value: 20}});

          // Save button is now enabled
          const saveRuleButtonEnabled = screen.getByRole('button', {name: 'Save Rule'});
          expect(saveRuleButtonEnabled).toBeEnabled();

          // Click on save button
          fireEvent.click(saveRuleButtonEnabled);

          // Modal will close
          await waitForElementToBeRemoved(() =>
            screen.getByText('Add Transaction Sampling Rule')
          );

          // Transaction rules panel is updated
          expect(
            screen.queryByText('There are no transaction rules to display')
          ).not.toBeInTheDocument();
          const individualTransactionRules = screen.getByText('Individual transactions');
          expect(individualTransactionRules).toBeInTheDocument();
          expect(screen.getByText('Legacy Browser')).toBeInTheDocument();
          for (const legacyBrowser of legacyBrowsers) {
            const {title} = LEGACY_BROWSER_LIST[legacyBrowser];
            expect(screen.getByText(title)).toBeInTheDocument();
          }
          expect(screen.getByText('20%')).toBeInTheDocument();
        });
      });
    });
  });
});
