import {
  screen,
  userEvent,
  waitForElementToBeRemoved,
  within,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {
  DYNAMIC_SAMPLING_DOC_LINK,
  LEGACY_BROWSER_LIST,
} from 'sentry/views/settings/project/filtersAndSampling/utils';

import {commonConditionCategories, renderComponent, renderModal} from './utils';

describe('Filters and Sampling - Transaction rule', function () {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/tags/',
      method: 'GET',
      body: TestStubs.Tags,
    });
  });

  describe('transaction rule', function () {
    it('renders', async function () {
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

      // Transaction traces and individual transactions rules container
      expect(
        screen.queryByText('There are no transaction rules to display')
      ).not.toBeInTheDocument();
      expect(screen.getByText('Transaction traces')).toBeInTheDocument();

      // Open rule modal - edit transaction rule
      await renderModal(screen.getByLabelText('Edit Rule'));

      // Modal content
      expect(screen.getByText('Edit Transaction Sampling Rule')).toBeInTheDocument();
      expect(screen.getByText('Tracing')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeChecked();

      // Release Field
      expect(screen.getByLabelText('Search or add a release')).toBeInTheDocument();

      // Release field is not empty
      expect(screen.getByTestId('multivalue')).toHaveTextContent('1.2.3');

      // Button is enabled - meaning the form is valid
      expect(screen.getByLabelText('Save Rule')).toBeEnabled();

      // Sample rate is not empty
      expect(screen.getByPlaceholderText('\u0025')).toHaveValue(20);

      // Clear release field
      userEvent.clear(screen.getByLabelText('Search or add a release'));

      // Release field is now empty
      expect(screen.queryByTestId('multivalue')).not.toBeInTheDocument();

      expect(screen.getByLabelText('Save Rule')).toBeDisabled();

      // Type into realease field
      userEvent.paste(screen.getByLabelText('Search or add a release'), '[0-9]');

      // Autocomplete suggests options
      expect(screen.getByTestId('[0-9]')).toHaveTextContent('[0-9]');

      // Click on the suggested option
      userEvent.click(screen.getByTestId('[0-9]'));

      expect(screen.getByLabelText('Save Rule')).toBeEnabled();

      // Clear sample rate field
      userEvent.clear(screen.getByPlaceholderText('\u0025'));

      expect(screen.getByLabelText('Save Rule')).toBeDisabled();

      // Update sample rate field
      userEvent.paste(screen.getByPlaceholderText('\u0025'), '60');

      // Save button is now enabled
      expect(screen.getByLabelText('Save Rule')).toBeEnabled();

      // Click on save button
      userEvent.click(screen.getByLabelText('Save Rule'));

      // Modal will close
      await waitForElementToBeRemoved(() =>
        screen.queryByText('Edit Transaction Sampling Rule')
      );

      expect(screen.getByText('Transaction traces')).toBeInTheDocument();
      expect(screen.getByText('Release')).toBeInTheDocument();

      // Old values
      expect(screen.queryByText('1.2.3')).not.toBeInTheDocument();
      expect(screen.queryByText('20%')).not.toBeInTheDocument();

      // New values
      expect(screen.getByText('[0-9]')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    describe('modal', function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'GET',
        body: TestStubs.Project(),
      });

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
          screen.getByText(
            textWithMarkupMatcher(
              'Include all related transactions by trace ID. This can span across multiple projects. All related errors will remain. Learn more about tracing.'
            )
          )
        ).toBeInTheDocument();
        expect(
          screen.getByRole('link', {
            name: 'Learn more about tracing',
          })
        ).toHaveAttribute('href', DYNAMIC_SAMPLING_DOC_LINK);
        expect(screen.getByText('Add Condition')).toBeInTheDocument();
        expect(
          screen.getByText('Apply sampling rate to all transactions')
        ).toBeInTheDocument();
        expect(screen.getByText('Sampling Rate \u0025')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('\u0025')).toHaveValue(null);
        expect(screen.getByLabelText('Cancel')).toBeInTheDocument();
        expect(screen.getByLabelText('Save Rule')).toBeDisabled();

        // Close Modal
        userEvent.click(screen.getByLabelText('Close Modal'));
        await waitForElementToBeRemoved(() =>
          screen.queryByText('Add Transaction Sampling Rule')
        );
      });

      it('condition options', async function () {
        renderComponent();

        // Open Modal
        await renderModal(screen.getByText('Add transaction rule'));

        // Click on 'Add condition'
        userEvent.click(screen.getByText('Add Condition'));

        // Autocomplete
        expect(screen.getByText(/filter conditions/i)).toBeInTheDocument();

        // Tracing Condition Options
        conditionTracingCategories.forEach(conditionTracingCategory => {
          expect(
            within(screen.getByRole('dialog')).getByText(conditionTracingCategory)
          ).toBeInTheDocument();
        });

        // Unchecked tracing checkbox
        userEvent.click(screen.getByRole('checkbox'));

        // Click on 'Add condition'
        userEvent.click(screen.getByText('Add Condition'));

        // No Tracing Condition Options
        commonConditionCategories.forEach(commonConditionCategory => {
          expect(
            within(screen.getByRole('dialog')).getByText(commonConditionCategory)
          ).toBeInTheDocument();
        });

        // Close Modal
        userEvent.click(screen.getByLabelText('Close Modal'));
        await waitForElementToBeRemoved(() =>
          screen.queryByText('Add Transaction Sampling Rule')
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
          userEvent.click(screen.getByText('Add Condition'));

          // Autocomplete
          expect(screen.getByText(/filter conditions/i)).toBeInTheDocument();

          // Click on the condition option
          userEvent.click(screen.getAllByText('Release')[0]);

          // Release Field
          expect(screen.getByLabelText('Search or add a release')).toBeInTheDocument();

          // Release field is empty
          expect(screen.queryByTestId('multivalue')).not.toBeInTheDocument();

          // Type into realease field
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

          // Modal will close
          await waitForElementToBeRemoved(() =>
            screen.queryByText('Add Transaction Sampling Rule')
          );

          // Transaction rules panel is updated
          expect(
            screen.queryByText('There are no transaction rules to display')
          ).not.toBeInTheDocument();
          expect(screen.getByText('Transaction traces')).toBeInTheDocument();
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
            userEvent.click(screen.getByRole('checkbox'));

            // Click on 'Add condition'
            userEvent.click(screen.getByText('Add Condition'));

            // Click on the first condition option
            userEvent.click(screen.getAllByText('Release')[0]);

            // Release Field
            expect(screen.getByLabelText('Search or add a release')).toBeInTheDocument();

            // Release field is empty
            expect(screen.queryByTestId('multivalue')).not.toBeInTheDocument();

            // Type into realease field
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

            // Modal will close
            await waitForElementToBeRemoved(() =>
              screen.queryByText('Add Transaction Sampling Rule')
            );

            // Transaction rules panel is updated
            expect(
              screen.queryByText('There are no transaction rules to display')
            ).not.toBeInTheDocument();
            expect(screen.getByText('Individual transactions')).toBeInTheDocument();
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

            // Checked tracing checkbox
            expect(screen.getByRole('checkbox')).toBeChecked();

            // Uncheck tracing checkbox
            userEvent.click(screen.getByRole('checkbox'));

            // Unched tracing checkbox
            expect(screen.getByRole('checkbox')).not.toBeChecked();

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

            // Button is still disabled
            expect(screen.getByLabelText('Save Rule')).toBeDisabled();

            // Fill sample rate field
            userEvent.paste(screen.getByPlaceholderText('\u0025'), '20');

            // Save button is now enabled
            expect(screen.getByLabelText('Save Rule')).toBeEnabled();

            // Click on save button
            userEvent.click(screen.getByLabelText('Save Rule'));

            // Modal will close
            await waitForElementToBeRemoved(() =>
              screen.queryByText('Add Transaction Sampling Rule')
            );

            // Transaction rules panel is updated
            expect(
              screen.queryByText('There are no transaction rules to display')
            ).not.toBeInTheDocument();
            expect(screen.getByText('Individual transactions')).toBeInTheDocument();
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

  describe('individual transaction rule', function () {
    it('renders', async function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'GET',
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

      // Transaction traces and individual transactions rules container
      expect(
        screen.queryByText('There are no transaction rules to display')
      ).not.toBeInTheDocument();
      expect(screen.getByText('Individual transactions')).toBeInTheDocument();

      // Open rule modal - edit transaction rule
      await renderModal(screen.getByLabelText('Edit Rule'));

      // Modal content
      expect(screen.getByText('Edit Transaction Sampling Rule')).toBeInTheDocument();
      expect(screen.getByText('Tracing')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).not.toBeChecked();

      // Release Field
      expect(screen.getByLabelText('Search or add a release')).toBeInTheDocument();

      // Release field is not empty
      expect(screen.getByTestId('multivalue')).toBeInTheDocument();

      // Button is enabled - meaning the form is valid
      expect(screen.getByLabelText('Save Rule')).toBeEnabled();

      // Sample rate is not empty
      expect(screen.getByPlaceholderText('\u0025')).toHaveValue(20);

      // Clear release field
      userEvent.clear(screen.getByLabelText('Search or add a release'));

      // Release field is now empty
      expect(screen.queryByTestId('multivalue')).not.toBeInTheDocument();

      expect(screen.getByLabelText('Save Rule')).toBeDisabled();

      // Type into realease field
      userEvent.paste(screen.getByLabelText('Search or add a release'), '[0-9]');

      // Autocomplete suggests options
      expect(screen.getByTestId('[0-9]')).toHaveTextContent('[0-9]');

      // Click on the suggested option
      userEvent.click(screen.getByTestId('[0-9]'));

      expect(screen.getByLabelText('Save Rule')).toBeEnabled();

      // Clear sample rate field
      userEvent.clear(screen.getByPlaceholderText('\u0025'));

      expect(screen.getByLabelText('Save Rule')).toBeDisabled();

      // Update sample rate field
      userEvent.paste(screen.getByPlaceholderText('\u0025'), '60');

      // Save button is now enabled
      expect(screen.getByLabelText('Save Rule')).toBeEnabled();

      // Click on save button
      userEvent.click(screen.getByLabelText('Save Rule'));

      // Modal will close
      await waitForElementToBeRemoved(() =>
        screen.queryByText('Edit Transaction Sampling Rule')
      );

      expect(screen.getByText('Individual transactions')).toBeInTheDocument();
      expect(screen.getByText('Release')).toBeInTheDocument();

      // Old values
      expect(screen.queryByText('1.2.3')).not.toBeInTheDocument();
      expect(screen.queryByText('20%')).not.toBeInTheDocument();

      // New values
      expect(screen.getByText('[0-9]')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });
  });
});
