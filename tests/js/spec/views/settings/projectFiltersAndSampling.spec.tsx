import {Fragment} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  fireEvent,
  mountWithTheme,
  screen,
  userEvent,
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

  // @ts-expect-error
  MockApiClient.addMockResponse({
    url: '/projects/org-slug/project-slug/',
    method: 'GET',
    // @ts-expect-error
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
    userEvent.click(actionElement);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    if (takeScreenshot) {
      expect(dialog).toSnapshot();
    }

    return within(dialog);
  }

  describe('renders', function () {
    it('empty', async function () {
      const component = renderComponent(false);
      const {container} = component;

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
      // @ts-expect-error
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'GET',
        // @ts-expect-error
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

      const component = renderComponent(false);
      const {container} = component;

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
      // @ts-expect-error
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'GET',
        // @ts-expect-error
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

      // @ts-expect-error
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'PUT',
        // @ts-expect-error
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

      // @ts-expect-error
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
      const modal = await renderModal(editRuleButtons[0]);

      // Modal content
      expect(modal.getByText('Edit Error Sampling Rule')).toBeInTheDocument();
      expect(modal.queryByText('Tracing')).not.toBeInTheDocument();

      // Release Field
      await modal.findByTestId('autocomplete-release');
      const releaseField = modal.getByTestId('autocomplete-release');
      expect(releaseField).toBeInTheDocument();

      // Release field is not empty
      const releaseFieldValues = within(releaseField).getByTestId('multivalue');
      expect(releaseFieldValues).toBeInTheDocument();
      expect(releaseFieldValues).toHaveTextContent('1*');

      // Button is enabled - meaning the form is valid
      const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeInTheDocument();
      expect(saveRuleButton).toBeEnabled();

      // Sample rate field
      const sampleRateField = modal.getByPlaceholderText('\u0025');
      expect(sampleRateField).toBeInTheDocument();

      // Sample rate is not empty
      expect(sampleRateField).toHaveValue(10);

      const releaseFieldInput = within(releaseField).getByLabelText(
        'Search or add a release'
      );

      // Clear release field
      fireEvent.keyDown(releaseFieldInput, {key: 'Backspace'});

      // Release field is now empty
      const newReleaseFieldValues = within(
        modal.getByTestId('autocomplete-release')
      ).queryByTestId('multivalue');
      expect(newReleaseFieldValues).not.toBeInTheDocument();

      expect(modal.getByRole('button', {name: 'Save Rule'})).toBeDisabled();

      // Type into realease field
      fireEvent.change(
        within(modal.getByTestId('autocomplete-release')).getByLabelText(
          'Search or add a release'
        ),
        {
          target: {value: '[I3].[0-9]'},
        }
      );

      // Autocomplete suggests options
      const autocompleteOptions = within(
        modal.getByTestId('autocomplete-release')
      ).getByTestId('option');
      expect(autocompleteOptions).toBeInTheDocument();
      expect(autocompleteOptions).toHaveTextContent('[I3].[0-9]');

      // Click on the suggested option
      userEvent.click(autocompleteOptions);

      expect(modal.getByRole('button', {name: 'Save Rule'})).toBeEnabled();

      // Clear sample rate field
      fireEvent.change(sampleRateField, {target: {value: null}});

      expect(modal.getByRole('button', {name: 'Save Rule'})).toBeDisabled();

      // Update sample rate field
      fireEvent.change(sampleRateField, {target: {value: 50}});

      // Save button is now enabled
      const saveRuleButtonEnabled = modal.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButtonEnabled).toBeEnabled();

      // Click on save button
      userEvent.click(saveRuleButtonEnabled);

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
      // @ts-expect-error
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'GET',
        // @ts-expect-error
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

      // @ts-expect-error
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'PUT',
        // @ts-expect-error
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

      // @ts-expect-error
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
      const modal = await renderModal(editRuleButtons[1]);

      // Modal content
      expect(modal.getByText('Edit Transaction Sampling Rule')).toBeInTheDocument();
      expect(modal.getByText('Tracing')).toBeInTheDocument();
      expect(modal.getByRole('checkbox')).toBeChecked();

      // Release Field
      await modal.findByTestId('autocomplete-release');
      const releaseField = modal.getByTestId('autocomplete-release');
      expect(releaseField).toBeInTheDocument();

      // Release field is not empty
      const releaseFieldValues = within(releaseField).getByTestId('multivalue');
      expect(releaseFieldValues).toBeInTheDocument();
      expect(releaseFieldValues).toHaveTextContent('1.2.3');

      // Button is enabled - meaning the form is valid
      const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeInTheDocument();
      expect(saveRuleButton).toBeEnabled();

      // Sample rate field
      const sampleRateField = modal.getByPlaceholderText('\u0025');
      expect(sampleRateField).toBeInTheDocument();

      // Sample rate is not empty
      expect(sampleRateField).toHaveValue(20);

      const releaseFieldInput = within(releaseField).getByLabelText(
        'Search or add a release'
      );

      // Clear release field
      fireEvent.keyDown(releaseFieldInput, {key: 'Backspace'});

      // Release field is now empty
      const newReleaseFieldValues = within(
        modal.getByTestId('autocomplete-release')
      ).queryByTestId('multivalue');
      expect(newReleaseFieldValues).not.toBeInTheDocument();

      expect(modal.getByRole('button', {name: 'Save Rule'})).toBeDisabled();

      // Type into realease field
      fireEvent.change(
        within(modal.getByTestId('autocomplete-release')).getByLabelText(
          'Search or add a release'
        ),
        {
          target: {value: '[0-9]'},
        }
      );

      // Autocomplete suggests options
      const autocompleteOptions = within(
        modal.getByTestId('autocomplete-release')
      ).getByTestId('option');
      expect(autocompleteOptions).toBeInTheDocument();
      expect(autocompleteOptions).toHaveTextContent('[0-9]');

      // Click on the suggested option
      userEvent.click(autocompleteOptions);

      expect(modal.getByRole('button', {name: 'Save Rule'})).toBeEnabled();

      // Clear sample rate field
      fireEvent.change(sampleRateField, {target: {value: null}});

      expect(modal.getByRole('button', {name: 'Save Rule'})).toBeDisabled();

      // Update sample rate field
      fireEvent.change(sampleRateField, {target: {value: 60}});

      // Save button is now enabled
      const saveRuleButtonEnabled = modal.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButtonEnabled).toBeEnabled();

      // Click on save button
      userEvent.click(saveRuleButtonEnabled);

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
      // @ts-expect-error
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'GET',
        // @ts-expect-error
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

      // @ts-expect-error
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'PUT',
        // @ts-expect-error
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

      // @ts-expect-error
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
      const modal = await renderModal(editRuleButtons[1]);

      // Modal content
      expect(modal.getByText('Edit Transaction Sampling Rule')).toBeInTheDocument();
      expect(modal.getByText('Tracing')).toBeInTheDocument();
      expect(modal.getByRole('checkbox')).not.toBeChecked();

      // Release Field
      await modal.findByTestId('autocomplete-release');
      const releaseField = modal.getByTestId('autocomplete-release');
      expect(releaseField).toBeInTheDocument();

      // Release field is not empty
      const releaseFieldValues = within(releaseField).getByTestId('multivalue');
      expect(releaseFieldValues).toBeInTheDocument();

      // Button is enabled - meaning the form is valid
      const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeInTheDocument();
      expect(saveRuleButton).toBeEnabled();

      // Sample rate field
      const sampleRateField = modal.getByPlaceholderText('\u0025');
      expect(sampleRateField).toBeInTheDocument();

      // Sample rate is not empty
      expect(sampleRateField).toHaveValue(20);

      const releaseFieldInput = within(releaseField).getByLabelText(
        'Search or add a release'
      );

      // Clear release field
      fireEvent.keyDown(releaseFieldInput, {key: 'Backspace'});

      // Release field is now empty
      const newReleaseFieldValues = within(
        modal.getByTestId('autocomplete-release')
      ).queryByTestId('multivalue');
      expect(newReleaseFieldValues).not.toBeInTheDocument();

      expect(modal.getByRole('button', {name: 'Save Rule'})).toBeDisabled();

      // Type into realease field
      fireEvent.change(
        within(modal.getByTestId('autocomplete-release')).getByLabelText(
          'Search or add a release'
        ),
        {
          target: {value: '[0-9]'},
        }
      );

      // Autocomplete suggests options
      const autocompleteOptions = within(
        modal.getByTestId('autocomplete-release')
      ).getByTestId('option');
      expect(autocompleteOptions).toBeInTheDocument();
      expect(autocompleteOptions).toHaveTextContent('[0-9]');

      // Click on the suggested option
      userEvent.click(autocompleteOptions);

      expect(modal.getByRole('button', {name: 'Save Rule'})).toBeEnabled();

      // Clear sample rate field
      fireEvent.change(sampleRateField, {target: {value: null}});

      expect(modal.getByRole('button', {name: 'Save Rule'})).toBeDisabled();

      // Update sample rate field
      fireEvent.change(sampleRateField, {target: {value: 60}});

      // Save button is now enabled
      const saveRuleButtonEnabled = modal.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButtonEnabled).toBeEnabled();

      // Click on save button
      userEvent.click(saveRuleButtonEnabled);

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
      // @ts-expect-error
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'GET',
        // @ts-expect-error
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

      // @ts-expect-error
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'PUT',
        // @ts-expect-error
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
      const modal = await renderModal(deleteRuleButtons[0]);

      expect(
        modal.getByText('Are you sure you wish to delete this dynamic sampling rule?')
      ).toBeInTheDocument();

      const modalActionButtons = modal.getAllByRole('button');
      expect(modalActionButtons).toHaveLength(2);
      expect(modalActionButtons[0]).toHaveTextContent('Cancel');
      expect(modalActionButtons[1]).toHaveTextContent('Confirm');

      // Confirm deletion
      userEvent.click(modalActionButtons[1]);

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
      const modal = await renderModal(screen.getByText('Add error rule'), true);

      // Modal content
      expect(modal.getByText('Add Error Sampling Rule')).toBeInTheDocument();
      expect(modal.queryByText('Tracing')).not.toBeInTheDocument();
      expect(modal.getByText('Conditions')).toBeInTheDocument();
      expect(modal.getByText('Add Condition')).toBeInTheDocument();
      expect(modal.getByText('Apply sampling rate to all errors')).toBeInTheDocument();
      expect(modal.getByText('Sampling Rate \u0025')).toBeInTheDocument();
      expect(modal.getByPlaceholderText('\u0025')).toHaveValue(null);
      expect(modal.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
      const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeInTheDocument();
      expect(saveRuleButton).toBeDisabled();

      // Close Modal
      userEvent.click(screen.getByLabelText('Close Modal'));
      await waitForElementToBeRemoved(() => screen.getByText('Add Error Sampling Rule'));
    });

    it('condition options', async function () {
      renderComponent();

      // Open Modal
      const modal = await renderModal(screen.getByText('Add error rule'));

      // Click on 'Add condition'
      userEvent.click(modal.getByText('Add Condition'));

      // Autocomplete
      const autoCompleteList = await screen.findByTestId('autocomplete-list');
      expect(autoCompleteList).toBeInTheDocument();

      // Condition Options
      const conditionOptions = modal.getAllByRole('presentation');
      expect(conditionOptions).toHaveLength(commonConditionCategories.length);

      for (const conditionOptionIndex in conditionOptions) {
        expect(conditionOptions[conditionOptionIndex]).toHaveTextContent(
          commonConditionCategories[conditionOptionIndex]
        );
      }

      // Close Modal
      userEvent.click(screen.getByLabelText('Close Modal'));
      await waitForElementToBeRemoved(() => screen.getByText('Add Error Sampling Rule'));
    });

    it('save rule', async function () {
      // @ts-expect-error
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'PUT',
        body:
          // @ts-expect-error
          TestStubs.Project({
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

      // @ts-expect-error
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/release/values/',
        method: 'GET',
        body: [{value: '1.2.3'}],
      });

      const component = renderComponent();
      const {getByText, queryByText} = component;

      // Open Modal
      const modal = await renderModal(getByText('Add error rule'));

      // Click on 'Add condition'
      userEvent.click(modal.getByText('Add Condition'));

      // Autocomplete
      const autoCompleteList = await modal.findByTestId('autocomplete-list');
      expect(autoCompleteList).toBeInTheDocument();

      // Condition Options
      const conditionOptions = modal.getAllByRole('presentation');

      // Click on the first condition option
      userEvent.click(conditionOptions[0]);

      // Release Field
      await modal.findByTestId('autocomplete-release');
      const releaseField = modal.getByTestId('autocomplete-release');
      expect(releaseField).toBeInTheDocument();

      // Release field is empty
      const releaseFieldValues = within(releaseField).queryByTestId('multivalue');
      expect(releaseFieldValues).not.toBeInTheDocument();

      // Type into realease field
      fireEvent.change(within(releaseField).getByLabelText('Search or add a release'), {
        target: {value: '1.2.3'},
      });

      // Autocomplete suggests options
      const autocompleteOptions = within(releaseField).getByTestId('option');
      expect(autocompleteOptions).toBeInTheDocument();
      expect(autocompleteOptions).toHaveTextContent('1.2.3');

      // Click on the suggested option
      userEvent.click(autocompleteOptions);

      // Button is still disabled
      const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeInTheDocument();
      expect(saveRuleButton).toBeDisabled();

      // Fill sample rate field
      const sampleRateField = modal.getByPlaceholderText('\u0025');
      expect(sampleRateField).toBeInTheDocument();
      fireEvent.change(sampleRateField, {target: {value: 20}});

      // Save button is now enabled
      const saveRuleButtonEnabled = modal.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButtonEnabled).toBeEnabled();

      // Click on save button
      userEvent.click(saveRuleButtonEnabled);

      // Modal will close
      await waitForElementToBeRemoved(() => getByText('Add Error Sampling Rule'));

      // Error rules panel is updated
      expect(queryByText('There are no error rules to display')).not.toBeInTheDocument();
      expect(getByText('Errors only')).toBeInTheDocument();
      expect(getByText('Release')).toBeInTheDocument();
      expect(getByText('1.2.3')).toBeInTheDocument();
      expect(getByText('20%')).toBeInTheDocument();
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
      const modal = await renderModal(screen.getByText('Add transaction rule'), true);

      // Modal content
      expect(modal.getByText('Add Transaction Sampling Rule')).toBeInTheDocument();
      expect(modal.getByText('Tracing')).toBeInTheDocument();
      expect(modal.getByRole('checkbox')).toBeChecked();
      expect(
        await findByTextContent(
          modal,
          'Include all related transactions by trace ID. This can span across multiple projects. All related errors will remain. Learn more about tracing.'
        )
      ).toBeTruthy();
      expect(
        modal.getByRole('link', {
          name: 'Learn more about tracing',
        })
      ).toHaveAttribute('href', DYNAMIC_SAMPLING_DOC_LINK);
      expect(modal.getByText('Conditions')).toBeInTheDocument();
      expect(modal.getByText('Add Condition')).toBeInTheDocument();
      expect(
        modal.getByText('Apply sampling rate to all transactions')
      ).toBeInTheDocument();
      expect(modal.getByText('Sampling Rate \u0025')).toBeInTheDocument();
      expect(modal.getByPlaceholderText('\u0025')).toHaveValue(null);
      expect(modal.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
      const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeInTheDocument();
      expect(saveRuleButton).toBeDisabled();

      // Close Modal
      userEvent.click(screen.getByLabelText('Close Modal'));
      await waitForElementToBeRemoved(() =>
        screen.getByText('Add Transaction Sampling Rule')
      );
    });

    it('condition options', async function () {
      const component = renderComponent();
      const {getByText, getByLabelText} = component;

      // Open Modal
      const modal = await renderModal(getByText('Add transaction rule'));

      // Click on 'Add condition'
      userEvent.click(modal.getByText('Add Condition'));

      // Autocomplete
      const autoCompleteList = await modal.findByTestId('autocomplete-list');
      expect(autoCompleteList).toBeInTheDocument();

      // Trancing Condition Options
      const conditionTracingOptions = modal.getAllByRole('presentation');
      expect(conditionTracingOptions).toHaveLength(conditionTracingCategories.length);

      for (const conditionTracingOptionIndex in conditionTracingOptions) {
        expect(conditionTracingOptions[conditionTracingOptionIndex]).toHaveTextContent(
          conditionTracingCategories[conditionTracingOptionIndex]
        );
      }

      // Unchecked tracing checkbox
      userEvent.click(modal.getByRole('checkbox'));

      // Click on 'Add condition'
      userEvent.click(modal.getByText('Add Condition'));

      // No Tracing Condition Options
      const conditionOptions = modal.getAllByRole('presentation');
      expect(conditionOptions).toHaveLength(commonConditionCategories.length);

      for (const conditionOptionIndex in conditionOptions) {
        expect(conditionOptions[conditionOptionIndex]).toHaveTextContent(
          commonConditionCategories[conditionOptionIndex]
        );
      }

      // Close Modal
      userEvent.click(getByLabelText('Close Modal'));
      await waitForElementToBeRemoved(() => getByText('Add Transaction Sampling Rule'));
    });

    describe('save rule', function () {
      it('transaction trace', async function () {
        // @ts-expect-error
        MockApiClient.addMockResponse({
          url: '/projects/org-slug/project-slug/',
          method: 'PUT',
          body:
            // @ts-expect-error
            TestStubs.Project({
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

        // @ts-expect-error
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/tags/release/values/',
          method: 'GET',
          body: [{value: '1.2.3'}],
        });

        renderComponent();

        // Open Modal
        const modal = await renderModal(screen.getByText('Add transaction rule'));

        // Checked tracing checkbox
        expect(modal.getByRole('checkbox')).toBeChecked();

        // Click on 'Add condition'
        userEvent.click(modal.getByText('Add Condition'));

        // Autocomplete
        const autoCompleteList = await modal.findByTestId('autocomplete-list');
        expect(autoCompleteList).toBeInTheDocument();

        // Condition Options
        const conditionOptions = modal.getAllByRole('presentation');

        // Click on the first condition option
        userEvent.click(conditionOptions[0]);

        // Release Field
        await modal.findByTestId('autocomplete-release');
        const releaseField = modal.getByTestId('autocomplete-release');
        expect(releaseField).toBeInTheDocument();

        // Release field is empty
        const releaseFieldValues = within(releaseField).queryByTestId('multivalue');
        expect(releaseFieldValues).not.toBeInTheDocument();

        // Type into realease field
        fireEvent.change(within(releaseField).getByLabelText('Search or add a release'), {
          target: {value: '1.2.3'},
        });

        // Autocomplete suggests options
        const autocompleteOptions = within(
          modal.getByTestId('autocomplete-release')
        ).getByTestId('option');
        expect(autocompleteOptions).toBeInTheDocument();
        expect(autocompleteOptions).toHaveTextContent('1.2.3');

        // Click on the suggested option
        userEvent.click(autocompleteOptions);

        // Button is still disabled
        const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
        expect(saveRuleButton).toBeInTheDocument();
        expect(saveRuleButton).toBeDisabled();

        // Fill sample rate field
        const sampleRateField = modal.getByPlaceholderText('\u0025');
        expect(sampleRateField).toBeInTheDocument();
        fireEvent.change(sampleRateField, {target: {value: 20}});

        // Save button is now enabled
        const saveRuleButtonEnabled = modal.getByRole('button', {name: 'Save Rule'});
        expect(saveRuleButtonEnabled).toBeEnabled();

        // Click on save button
        userEvent.click(saveRuleButtonEnabled);

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
          // @ts-expect-error
          MockApiClient.addMockResponse({
            url: '/projects/org-slug/project-slug/',
            method: 'PUT',
            body:
              // @ts-expect-error
              TestStubs.Project({
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

          // @ts-expect-error
          MockApiClient.addMockResponse({
            url: '/organizations/org-slug/tags/release/values/',
            method: 'GET',
            body: [{value: '1.2.3'}],
          });

          renderComponent();

          // Open Modal
          const modal = await renderModal(screen.getByText('Add transaction rule'));

          // Unchecked tracing checkbox
          userEvent.click(modal.getByRole('checkbox'));

          // Click on 'Add condition'
          userEvent.click(modal.getByText('Add Condition'));

          // Autocomplete
          const autoCompleteList = await screen.findByTestId('autocomplete-list');
          expect(autoCompleteList).toBeInTheDocument();

          // Condition Options
          const conditionOptions = modal.getAllByRole('presentation');

          // Click on the first condition option
          userEvent.click(conditionOptions[0]);

          // Release Field
          await modal.findByTestId('autocomplete-release');
          const releaseField = modal.getByTestId('autocomplete-release');
          expect(releaseField).toBeInTheDocument();

          // Release field is empty
          const releaseFieldValues = within(releaseField).queryByTestId('multivalue');
          expect(releaseFieldValues).not.toBeInTheDocument();

          // Type into realease field
          fireEvent.change(
            within(releaseField).getByLabelText('Search or add a release'),
            {
              target: {value: '1.2.3'},
            }
          );

          // Autocomplete suggests options
          const autocompleteOptions = within(
            modal.getByTestId('autocomplete-release')
          ).getByTestId('option');
          expect(autocompleteOptions).toBeInTheDocument();
          expect(autocompleteOptions).toHaveTextContent('1.2.3');

          // Click on the suggested option
          userEvent.click(autocompleteOptions);

          // Button is still disabled
          const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
          expect(saveRuleButton).toBeInTheDocument();
          expect(saveRuleButton).toBeDisabled();

          // Fill sample rate field
          const sampleRateField = modal.getByPlaceholderText('\u0025');
          expect(sampleRateField).toBeInTheDocument();
          fireEvent.change(sampleRateField, {target: {value: 20}});

          // Save button is now enabled
          const saveRuleButtonEnabled = modal.getByRole('button', {name: 'Save Rule'});
          expect(saveRuleButtonEnabled).toBeEnabled();

          // Click on save button
          userEvent.click(saveRuleButtonEnabled);

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
          // @ts-expect-error
          MockApiClient.addMockResponse({
            url: '/projects/org-slug/project-slug/',
            method: 'PUT',
            body:
              // @ts-expect-error
              TestStubs.Project({
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
          const modal = await renderModal(screen.getByText('Add transaction rule'));
          const checkedCheckbox = modal.getByRole('checkbox');

          // Checked tracing checkbox
          expect(checkedCheckbox).toBeChecked();

          // Uncheck tracing checkbox
          userEvent.click(checkedCheckbox);

          // Unched tracing checkbox
          expect(checkedCheckbox).not.toBeChecked();

          // Click on 'Add condition'
          userEvent.click(modal.getByText('Add Condition'));

          // Autocomplete
          const autoCompleteList = await screen.findByTestId('autocomplete-list');
          expect(autoCompleteList).toBeInTheDocument();

          // Condition Options
          const conditionOptions = modal.getAllByRole('presentation');

          // Click on the seventh condition option
          userEvent.click(conditionOptions[6]);

          // Legacy Browsers
          expect(modal.getByText('All browsers')).toBeInTheDocument();

          const legacyBrowsers = Object.keys(LEGACY_BROWSER_LIST);
          for (const legacyBrowser of legacyBrowsers) {
            const {icon, title} = LEGACY_BROWSER_LIST[legacyBrowser];
            expect(modal.getByText(title)).toBeInTheDocument();
            expect(modal.getAllByTestId(`icon-${icon}`)[0]).toBeInTheDocument();
          }

          expect(modal.getAllByTestId('icon-internet-explorer')).toHaveLength(4);
          expect(modal.getAllByTestId('icon-opera')).toHaveLength(2);
          expect(modal.getByTestId('icon-safari')).toBeInTheDocument();
          expect(modal.getByTestId('icon-android')).toBeInTheDocument();

          const switchButtons = modal.getAllByTestId('switch');
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

          // Button is still disabled
          const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
          expect(saveRuleButton).toBeInTheDocument();
          expect(saveRuleButton).toBeDisabled();

          // Fill sample rate field
          const sampleRateField = modal.getByPlaceholderText('\u0025');
          expect(sampleRateField).toBeInTheDocument();
          fireEvent.change(sampleRateField, {target: {value: 20}});

          // Save button is now enabled
          const saveRuleButtonEnabled = modal.getByRole('button', {name: 'Save Rule'});
          expect(saveRuleButtonEnabled).toBeEnabled();

          // Click on save button
          userEvent.click(saveRuleButtonEnabled);

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
