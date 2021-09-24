import {Fragment} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  BoundFunctions,
  FindByRole,
  fireEvent,
  mountWithTheme,
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
    'Releases',
    'Environments',
    'User Id',
    'User Segment',
    'Browser Extensions',
    'Localhost',
    'Legacy Browsers',
    'Web Crawlers',
    'IP Addresses',
    'Content Security Policy',
    'Error Messages',
    'Transactions',
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

  async function renderModal(
    screen: BoundFunctions<{findByRole: FindByRole}>,
    actionElement: HTMLElement,
    takeScreenshot = false
  ) {
    // Open Modal
    fireEvent.click(actionElement);
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
      const {container, getByRole, getByText, queryAllByRole, queryAllByText} = component;

      // Title
      expect(getByText('Filters & Sampling')).toBeTruthy();

      // Error rules container
      expect(
        await findByTextContent(
          component,
          'Manage the inbound data you want to store. To change the sampling rate or rate limits, update your SDK configuration. The rules added below will apply on top of your SDK configuration. Any new rule may take a few minutes to propagate.'
        )
      ).toBeTruthy();

      expect(
        getByRole('link', {
          name: 'update your SDK configuration',
        })
      ).toHaveAttribute('href', DYNAMIC_SAMPLING_DOC_LINK);

      expect(getByText('There are no error rules to display')).toBeTruthy();
      expect(getByText('Add error rule')).toBeTruthy();

      // Transaction traces and individual transactions rules container
      expect(
        getByText('Rules for traces should precede rules for individual transactions.')
      ).toBeTruthy();

      expect(getByText('There are no transaction rules to display')).toBeTruthy();
      expect(getByText('Add transaction rule')).toBeTruthy();

      const readDocsButtonLinks = queryAllByRole('button', {name: 'Read the docs'});
      expect(readDocsButtonLinks).toHaveLength(2);

      for (const readDocsButtonLink of readDocsButtonLinks) {
        expect(readDocsButtonLink).toHaveAttribute('href', DYNAMIC_SAMPLING_DOC_LINK);
      }

      expect(queryAllByText('Type')).toHaveLength(2);
      expect(queryAllByText('Conditions')).toHaveLength(2);
      expect(queryAllByText('Rate')).toHaveLength(2);

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
      const {
        container,
        getByRole,
        getByText,
        queryAllByRole,
        queryAllByText,
        queryByText,
      } = component;

      // Title
      expect(getByText('Filters & Sampling')).toBeTruthy();

      // Error rules container
      expect(
        await findByTextContent(
          component,
          'Manage the inbound data you want to store. To change the sampling rate or rate limits, update your SDK configuration. The rules added below will apply on top of your SDK configuration. Any new rule may take a few minutes to propagate.'
        )
      ).toBeTruthy();

      expect(
        getByRole('link', {
          name: 'update your SDK configuration',
        })
      ).toHaveAttribute('href', DYNAMIC_SAMPLING_DOC_LINK);

      expect(queryByText('There are no error rules to display')).toBeFalsy();
      const errorRules = queryAllByText('Errors only');
      expect(errorRules).toHaveLength(1);

      expect(getByText('Add error rule')).toBeTruthy();

      // Transaction traces and individual transactions rules container
      expect(
        getByText('Rules for traces should precede rules for individual transactions.')
      ).toBeTruthy();

      expect(queryByText('There are no transaction rules to display')).toBeFalsy();
      const transactionTraceRules = queryAllByText('Transaction traces');
      expect(transactionTraceRules).toHaveLength(1);

      const individualTransactionRules = queryAllByText('Individual transactions');
      expect(individualTransactionRules).toHaveLength(1);

      expect(getByText('Add transaction rule')).toBeTruthy();

      const readDocsButtonLinks = queryAllByRole('button', {name: 'Read the docs'});
      expect(readDocsButtonLinks).toHaveLength(2);

      for (const readDocsButtonLink of readDocsButtonLinks) {
        expect(readDocsButtonLink).toHaveAttribute('href', DYNAMIC_SAMPLING_DOC_LINK);
      }

      expect(queryAllByText('Type')).toHaveLength(2);
      expect(queryAllByText('Conditions')).toHaveLength(2);
      expect(queryAllByText('Rate')).toHaveLength(2);

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

      const component = renderComponent();
      const {queryAllByText, queryByText, getByText, queryAllByLabelText} = component;

      // Error rules container
      expect(queryByText('There are no error rules to display')).toBeFalsy();
      const errorRules = queryAllByText('Errors only');
      expect(errorRules).toHaveLength(1);

      // Transaction traces and individual transactions rules container
      expect(queryByText('There are no transaction rules to display')).toBeFalsy();
      const transactionTraceRules = queryAllByText('Transaction traces');
      expect(transactionTraceRules).toHaveLength(1);

      const editRuleButtons = queryAllByLabelText('Edit Rule');
      expect(editRuleButtons).toHaveLength(2);

      // Open rule modal - edit error rule
      const modal = await renderModal(component, editRuleButtons[0]);

      // Modal content
      expect(modal.getByText('Edit Error Sampling Rule')).toBeTruthy();
      expect(modal.queryByText('Tracing')).toBeFalsy();

      // Release Field
      const releaseField = modal.getByPlaceholderText(
        'ex. 1* or [I3].[0-9].* (Multiline)'
      );
      expect(releaseField).toBeTruthy();

      // Release field is not empty
      expect(releaseField).toHaveValue('1*');

      // Button is enabled - meaning the form is valid
      const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeTruthy();
      expect(saveRuleButton).toBeEnabled();

      // Sample rate field
      const sampleRateField = modal.getByPlaceholderText('\u0025');
      expect(sampleRateField).toBeTruthy();

      // Sample rate is not empty
      expect(sampleRateField).toHaveValue(10);

      // Clear release field
      fireEvent.change(releaseField, {target: {value: ''}});

      expect(modal.getByRole('button', {name: 'Save Rule'})).toBeDisabled();

      // Add new value to the release field
      fireEvent.change(releaseField, {target: {value: '[I3].[0-9]'}});

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
      fireEvent.click(saveRuleButtonEnabled);

      // Modal will close
      await waitForElementToBeRemoved(() => getByText('Edit Error Sampling Rule'));

      // Error rules panel is updated
      expect(errorRules).toHaveLength(1);

      expect(getByText('Errors only')).toBeTruthy();
      expect(queryAllByText('Release')).toHaveLength(2);

      // Old values
      expect(queryByText('1*')).toBeFalsy();
      expect(queryByText('10%')).toBeFalsy();

      // New values
      expect(getByText('[I3].[0-9]')).toBeTruthy();
      expect(getByText('50%')).toBeTruthy();
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

      const component = renderComponent();
      const {queryAllByText, queryByText, getByText, queryAllByLabelText} = component;

      // Error rules container
      expect(queryByText('There are no error rules to display')).toBeFalsy();
      const errorRules = queryAllByText('Errors only');
      expect(errorRules).toHaveLength(1);

      // Transaction traces and individual transactions rules container
      expect(queryByText('There are no transaction rules to display')).toBeFalsy();
      const transactionTraceRules = queryAllByText('Transaction traces');
      expect(transactionTraceRules).toHaveLength(1);

      const editRuleButtons = queryAllByLabelText('Edit Rule');
      expect(editRuleButtons).toHaveLength(2);

      // Open rule modal - edit transaction rule
      const modal = await renderModal(component, editRuleButtons[1]);

      // Modal content
      expect(modal.getByText('Edit Transaction Sampling Rule')).toBeTruthy();
      expect(modal.queryByText('Tracing')).toBeTruthy();
      expect(modal.getByRole('checkbox')).toBeChecked();

      // Release Field
      const releaseField = modal.getByPlaceholderText(
        'ex. 1* or [I3].[0-9].* (Multiline)'
      );
      expect(releaseField).toBeTruthy();

      // Release field is not empty
      expect(releaseField).toHaveValue('1.2.3');

      // Button is enabled - meaning the form is valid
      const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeTruthy();
      expect(saveRuleButton).toBeEnabled();

      // Sample rate field
      const sampleRateField = modal.getByPlaceholderText('\u0025');
      expect(sampleRateField).toBeTruthy();

      // Sample rate is not empty
      expect(sampleRateField).toHaveValue(20);

      // Clear release field
      fireEvent.change(releaseField, {target: {value: ''}});

      expect(modal.getByRole('button', {name: 'Save Rule'})).toBeDisabled();

      // Add new value to the release field
      fireEvent.change(releaseField, {target: {value: '[0-9]'}});

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
      fireEvent.click(saveRuleButtonEnabled);

      // Modal will close
      await waitForElementToBeRemoved(() => getByText('Edit Transaction Sampling Rule'));

      // Error rules panel is updated
      expect(errorRules).toHaveLength(1);

      expect(getByText('Transaction traces')).toBeTruthy();
      expect(queryAllByText('Release')).toHaveLength(2);

      // Old values
      expect(queryByText('1.2.3')).toBeFalsy();
      expect(queryByText('20%')).toBeFalsy();

      // New values
      expect(getByText('[0-9]')).toBeTruthy();
      expect(getByText('60%')).toBeTruthy();
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

      const component = renderComponent();
      const {queryAllByText, queryByText, getByText, queryAllByLabelText} = component;

      // Error rules container
      expect(queryByText('There are no error rules to display')).toBeFalsy();
      const errorRules = queryAllByText('Errors only');
      expect(errorRules).toHaveLength(1);

      // Transaction traces and individual transactions rules container
      expect(queryByText('There are no transaction rules to display')).toBeFalsy();
      const transactionTraceRules = queryAllByText('Individual transactions');
      expect(transactionTraceRules).toHaveLength(1);

      const editRuleButtons = queryAllByLabelText('Edit Rule');
      expect(editRuleButtons).toHaveLength(2);

      // Open rule modal - edit transaction rule
      const modal = await renderModal(component, editRuleButtons[1]);

      // Modal content
      expect(modal.getByText('Edit Transaction Sampling Rule')).toBeTruthy();
      expect(modal.queryByText('Tracing')).toBeTruthy();
      expect(modal.getByRole('checkbox')).not.toBeChecked();

      // Release Field
      const releaseField = modal.getByPlaceholderText(
        'ex. 1* or [I3].[0-9].* (Multiline)'
      );
      expect(releaseField).toBeTruthy();

      // Release field is not empty
      expect(releaseField).toHaveValue('1.2.3');

      // Button is enabled - meaning the form is valid
      const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeTruthy();
      expect(saveRuleButton).toBeEnabled();

      // Sample rate field
      const sampleRateField = modal.getByPlaceholderText('\u0025');
      expect(sampleRateField).toBeTruthy();

      // Sample rate is not empty
      expect(sampleRateField).toHaveValue(20);

      // Clear release field
      fireEvent.change(releaseField, {target: {value: ''}});

      expect(modal.getByRole('button', {name: 'Save Rule'})).toBeDisabled();

      // Add new value to the release field
      fireEvent.change(releaseField, {target: {value: '[0-9]'}});

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
      fireEvent.click(saveRuleButtonEnabled);

      // Modal will close
      await waitForElementToBeRemoved(() => getByText('Edit Transaction Sampling Rule'));

      // Error rules panel is updated
      expect(errorRules).toHaveLength(1);

      expect(getByText('Individual transactions')).toBeTruthy();
      expect(queryAllByText('Release')).toHaveLength(2);

      // Old values
      expect(queryByText('1.2.3')).toBeFalsy();
      expect(queryByText('20%')).toBeFalsy();

      // New values
      expect(getByText('[0-9]')).toBeTruthy();
      expect(getByText('60%')).toBeTruthy();
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

      const component = renderComponent();
      const {queryAllByText, queryByText, getByText, queryAllByLabelText} = component;

      // Error rules container
      expect(queryByText('There are no error rules to display')).toBeFalsy();
      const errorRules = queryAllByText('Errors only');
      expect(errorRules).toHaveLength(1);

      // Transaction traces and individual transactions rules container
      expect(queryByText('There are no transaction rules to display')).toBeFalsy();
      const transactionTraceRules = queryAllByText('Transaction traces');
      expect(transactionTraceRules).toHaveLength(1);

      const deleteRuleButtons = queryAllByLabelText('Delete Rule');
      expect(deleteRuleButtons).toHaveLength(2);

      // Open deletion confirmation modal - delete error rule
      const modal = await renderModal(component, deleteRuleButtons[0]);

      expect(
        modal.getByText('Are you sure you wish to delete this dynamic sampling rule?')
      ).toBeTruthy();

      const modalActionButtons = modal.queryAllByRole('button');
      expect(modalActionButtons).toHaveLength(2);
      expect(modalActionButtons[0].textContent).toEqual('Cancel');
      expect(modalActionButtons[1].textContent).toEqual('Confirm');

      // Confirm deletion
      fireEvent.click(modalActionButtons[1]);

      // Confirmation modal will close
      await waitForElementToBeRemoved(() =>
        getByText('Are you sure you wish to delete this dynamic sampling rule?')
      );

      // Error rules panel is updated
      expect(queryByText('There are no error rules to display')).toBeTruthy();

      // There is still one transaction rule
      expect(transactionTraceRules).toHaveLength(1);
    });

    it('transaction rule', async function () {
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
            next_id: 43,
          },
        }),
      });

      const component = renderComponent();
      const {queryAllByText, queryByText, getByText, queryAllByLabelText} = component;

      // Error rules container
      expect(queryByText('There are no error rules to display')).toBeFalsy();
      const errorRules = queryAllByText('Errors only');
      expect(errorRules).toHaveLength(1);

      // Transaction traces and individual transactions rules container
      expect(queryByText('There are no transaction rules to display')).toBeFalsy();
      const transactionTraceRules = queryAllByText('Transaction traces');
      expect(transactionTraceRules).toHaveLength(1);

      const deleteRuleButtons = queryAllByLabelText('Delete Rule');
      expect(deleteRuleButtons).toHaveLength(2);

      // Open deletion confirmation modal - delete transaction rule
      const modal = await renderModal(component, deleteRuleButtons[1]);

      expect(
        modal.getByText('Are you sure you wish to delete this dynamic sampling rule?')
      ).toBeTruthy();

      const modalActionButtons = modal.queryAllByRole('button');
      expect(modalActionButtons).toHaveLength(2);
      expect(modalActionButtons[0].textContent).toEqual('Cancel');
      expect(modalActionButtons[1].textContent).toEqual('Confirm');

      // Confirm deletion
      fireEvent.click(modalActionButtons[1]);

      // Confirmation modal will close
      await waitForElementToBeRemoved(() =>
        getByText('Are you sure you wish to delete this dynamic sampling rule?')
      );

      // Transaction rules panel is updated
      expect(queryByText('There are no transaction rules to display')).toBeTruthy();

      // There is still one transaction rule
      expect(errorRules).toHaveLength(1);
    });
  });

  describe('error rule modal', function () {
    it('renders modal', async function () {
      const component = renderComponent();
      const {getByText, getByLabelText} = component;

      // Open Modal
      const modal = await renderModal(component, getByText('Add error rule'), true);

      // Modal content
      expect(modal.getByText('Add Error Sampling Rule')).toBeTruthy();
      expect(modal.queryByText('Tracing')).toBeFalsy();
      expect(modal.getByText('Conditions')).toBeTruthy();
      expect(modal.getByText('Add Condition')).toBeTruthy();
      expect(modal.getByText('Apply sampling rate to all errors')).toBeTruthy();
      expect(modal.getByText('Sampling Rate \u0025')).toBeTruthy();
      expect(modal.getByPlaceholderText('\u0025')).toHaveValue(null);
      expect(modal.getByRole('button', {name: 'Cancel'})).toBeTruthy();
      const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeTruthy();
      expect(saveRuleButton).toBeDisabled();

      // Close Modal
      fireEvent.click(getByLabelText('Close Modal'));
      await waitForElementToBeRemoved(() => getByText('Add Error Sampling Rule'));
    });

    it('condition options', async function () {
      const component = renderComponent();
      const {getByText, findByTestId, getByLabelText} = component;

      // Open Modal
      const modal = await renderModal(component, getByText('Add error rule'));

      // Click on 'Add condition'
      fireEvent.click(modal.getByText('Add Condition'));

      // Autocomplete
      const autoCompleteList = await findByTestId('autocomplete-list');
      expect(autoCompleteList).toBeInTheDocument();

      // Condition Options
      const conditionOptions = modal.queryAllByRole('presentation');
      expect(conditionOptions).toHaveLength(commonConditionCategories.length);

      for (const conditionOptionIndex in conditionOptions) {
        expect(conditionOptions[conditionOptionIndex].textContent).toEqual(
          commonConditionCategories[conditionOptionIndex]
        );
      }

      // Close Modal
      fireEvent.click(getByLabelText('Close Modal'));
      await waitForElementToBeRemoved(() => getByText('Add Error Sampling Rule'));
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

      const component = renderComponent();
      const {getByText, queryByText, queryAllByText} = component;

      // Open Modal
      const modal = await renderModal(component, getByText('Add error rule'));

      // Click on 'Add condition'
      fireEvent.click(modal.getByText('Add Condition'));

      // Autocomplete
      const autoCompleteList = await modal.findByTestId('autocomplete-list');
      expect(autoCompleteList).toBeInTheDocument();

      // Condition Options
      const conditionOptions = modal.queryAllByRole('presentation');

      // Click on the first condition option
      fireEvent.click(conditionOptions[0]);

      // Release Field
      const releaseField = modal.getByPlaceholderText(
        'ex. 1* or [I3].[0-9].* (Multiline)'
      );
      expect(releaseField).toBeTruthy();

      // Fill release field
      fireEvent.change(releaseField, {target: {value: '1.2.3'}});

      // Button is still disabled
      const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeTruthy();
      expect(saveRuleButton).toBeDisabled();

      // Fill sample rate field
      const sampleRateField = modal.getByPlaceholderText('\u0025');
      expect(sampleRateField).toBeTruthy();
      fireEvent.change(sampleRateField, {target: {value: 20}});

      // Save button is now enabled
      const saveRuleButtonEnabled = modal.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButtonEnabled).toBeEnabled();

      // Click on save button
      fireEvent.click(saveRuleButtonEnabled);

      // Modal will close
      await waitForElementToBeRemoved(() => getByText('Add Error Sampling Rule'));

      // Error rules panel is updated
      expect(queryByText('There are no error rules to display')).toBeFalsy();
      const errorRules = queryAllByText('Errors only');
      expect(errorRules).toHaveLength(1);
      expect(getByText('Release')).toBeTruthy();
      expect(getByText('1.2.3')).toBeTruthy();
      expect(getByText('20%')).toBeTruthy();
    });
  });

  describe('transaction rule modal', function () {
    const conditionTracingCategories = [
      'Releases',
      'Environments',
      'User Id',
      'User Segment',
      'Transactions',
    ];

    it('renders modal', async function () {
      const component = renderComponent();
      const {getByText, getByLabelText} = component;

      // Open Modal
      const modal = await renderModal(component, getByText('Add transaction rule'), true);

      // Modal content
      expect(modal.getByText('Add Transaction Sampling Rule')).toBeTruthy();
      expect(modal.getByText('Tracing')).toBeTruthy();
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
      expect(modal.getByText('Conditions')).toBeTruthy();
      expect(modal.getByText('Add Condition')).toBeTruthy();
      expect(modal.getByText('Apply sampling rate to all transactions')).toBeTruthy();
      expect(modal.getByText('Sampling Rate \u0025')).toBeTruthy();
      expect(modal.getByPlaceholderText('\u0025')).toHaveValue(null);
      expect(modal.getByRole('button', {name: 'Cancel'})).toBeTruthy();
      const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
      expect(saveRuleButton).toBeTruthy();
      expect(saveRuleButton).toBeDisabled();

      // Close Modal
      fireEvent.click(getByLabelText('Close Modal'));
      await waitForElementToBeRemoved(() => getByText('Add Transaction Sampling Rule'));
    });

    it('condition options', async function () {
      const component = renderComponent();
      const {getByText, getByLabelText} = component;

      // Open Modal
      const modal = await renderModal(component, getByText('Add transaction rule'));

      // Click on 'Add condition'
      fireEvent.click(modal.getByText('Add Condition'));

      // Autocomplete
      const autoCompleteList = await modal.findByTestId('autocomplete-list');
      expect(autoCompleteList).toBeInTheDocument();

      // Trancing Condition Options
      const conditionTracingOptions = modal.queryAllByRole('presentation');
      expect(conditionTracingOptions).toHaveLength(conditionTracingCategories.length);

      for (const conditionTracingOptionIndex in conditionTracingOptions) {
        expect(conditionTracingOptions[conditionTracingOptionIndex].textContent).toEqual(
          conditionTracingCategories[conditionTracingOptionIndex]
        );
      }

      // Unchecked tracing checkbox
      fireEvent.click(modal.getByRole('checkbox'));

      // Click on 'Add condition'
      fireEvent.click(modal.getByText('Add Condition'));

      // No Tracing Condition Options
      const conditionOptions = modal.queryAllByRole('presentation');
      expect(conditionOptions).toHaveLength(commonConditionCategories.length);

      for (const conditionOptionIndex in conditionOptions) {
        expect(conditionOptions[conditionOptionIndex].textContent).toEqual(
          commonConditionCategories[conditionOptionIndex]
        );
      }

      // Close Modal
      fireEvent.click(getByLabelText('Close Modal'));
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

        const component = renderComponent();
        const {getByText, queryByText, queryAllByText} = component;

        // Open Modal
        const modal = await renderModal(component, getByText('Add transaction rule'));

        // Checked tracing checkbox
        expect(modal.getByRole('checkbox')).toBeChecked();

        // Click on 'Add condition'
        fireEvent.click(modal.getByText('Add Condition'));

        // Autocomplete
        const autoCompleteList = await modal.findByTestId('autocomplete-list');
        expect(autoCompleteList).toBeInTheDocument();

        // Condition Options
        const conditionOptions = modal.queryAllByRole('presentation');

        // Click on the first condition option
        fireEvent.click(conditionOptions[0]);

        // Release Field
        const releaseField = modal.getByPlaceholderText(
          'ex. 1* or [I3].[0-9].* (Multiline)'
        );
        expect(releaseField).toBeTruthy();

        // Fill release field
        fireEvent.change(releaseField, {target: {value: '1.2.3'}});

        // Button is still disabled
        const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
        expect(saveRuleButton).toBeTruthy();
        expect(saveRuleButton).toBeDisabled();

        // Fill sample rate field
        const sampleRateField = modal.getByPlaceholderText('\u0025');
        expect(sampleRateField).toBeTruthy();
        fireEvent.change(sampleRateField, {target: {value: 20}});

        // Save button is now enabled
        const saveRuleButtonEnabled = modal.getByRole('button', {name: 'Save Rule'});
        expect(saveRuleButtonEnabled).toBeEnabled();

        // Click on save button
        fireEvent.click(saveRuleButtonEnabled);

        // Modal will close
        await waitForElementToBeRemoved(() => getByText('Add Transaction Sampling Rule'));

        // Transaction rules panel is updated
        expect(queryByText('There are no transaction rules to display')).toBeFalsy();
        const transactionTraceRules = queryAllByText('Transaction traces');
        expect(transactionTraceRules).toHaveLength(1);
        expect(getByText('Release')).toBeTruthy();
        expect(getByText('1.2.3')).toBeTruthy();
        expect(getByText('20%')).toBeTruthy();
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

          const component = renderComponent();
          const {getByText, queryByText, queryAllByText, findByTestId} = component;

          // Open Modal
          const modal = await renderModal(component, getByText('Add transaction rule'));

          // Unchecked tracing checkbox
          fireEvent.click(modal.getByRole('checkbox'));

          // Click on 'Add condition'
          fireEvent.click(modal.getByText('Add Condition'));

          // Autocomplete
          const autoCompleteList = await findByTestId('autocomplete-list');
          expect(autoCompleteList).toBeInTheDocument();

          // Condition Options
          const conditionOptions = modal.queryAllByRole('presentation');

          // Click on the first condition option
          fireEvent.click(conditionOptions[0]);

          // Release Field
          const releaseField = modal.getByPlaceholderText(
            'ex. 1* or [I3].[0-9].* (Multiline)'
          );
          expect(releaseField).toBeTruthy();

          // Fill release field
          fireEvent.change(releaseField, {target: {value: '1.2.3'}});

          // Button is still disabled
          const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
          expect(saveRuleButton).toBeTruthy();
          expect(saveRuleButton).toBeDisabled();

          // Fill sample rate field
          const sampleRateField = modal.getByPlaceholderText('\u0025');
          expect(sampleRateField).toBeTruthy();
          fireEvent.change(sampleRateField, {target: {value: 20}});

          // Save button is now enabled
          const saveRuleButtonEnabled = modal.getByRole('button', {name: 'Save Rule'});
          expect(saveRuleButtonEnabled).toBeEnabled();

          // Click on save button
          fireEvent.click(saveRuleButtonEnabled);

          // Modal will close
          await waitForElementToBeRemoved(() =>
            getByText('Add Transaction Sampling Rule')
          );

          // Transaction rules panel is updated
          expect(queryByText('There are no transaction rules to display')).toBeFalsy();
          const individualTransactionRules = queryAllByText('Individual transactions');
          expect(individualTransactionRules).toHaveLength(1);
          expect(getByText('Release')).toBeTruthy();
          expect(getByText('1.2.3')).toBeTruthy();
          expect(getByText('20%')).toBeTruthy();
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

          const component = renderComponent();
          const {getByText, queryByText, queryAllByText, findByTestId} = component;

          // Open Modal
          const modal = await renderModal(component, getByText('Add transaction rule'));
          const checkedCheckbox = modal.getByRole('checkbox');

          // Checked tracing checkbox
          expect(checkedCheckbox).toBeChecked();

          // Uncheck tracing checkbox
          fireEvent.click(checkedCheckbox);

          // Unched tracing checkbox
          expect(checkedCheckbox).not.toBeChecked();

          // Click on 'Add condition'
          fireEvent.click(modal.getByText('Add Condition'));

          // Autocomplete
          const autoCompleteList = await findByTestId('autocomplete-list');
          expect(autoCompleteList).toBeInTheDocument();

          // Condition Options
          const conditionOptions = modal.queryAllByRole('presentation');

          // Click on the seventh condition option
          fireEvent.click(conditionOptions[6]);

          // Legacy Browsers
          expect(modal.getByText('All browsers')).toBeTruthy();

          const legacyBrowsers = Object.keys(LEGACY_BROWSER_LIST);
          for (const legacyBrowser of legacyBrowsers) {
            const {icon, title} = LEGACY_BROWSER_LIST[legacyBrowser];
            expect(modal.getByText(title)).toBeTruthy();
            expect(modal.queryAllByTestId(`icon-${icon}`)).toBeTruthy();
          }

          expect(modal.queryAllByTestId('icon-internet-explorer')).toHaveLength(4);
          expect(modal.queryAllByTestId('icon-opera')).toHaveLength(2);
          expect(modal.queryAllByTestId('icon-safari')).toHaveLength(1);
          expect(modal.queryAllByTestId('icon-android')).toHaveLength(1);

          const switchButtons = modal.queryAllByTestId('switch');
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
          const saveRuleButton = modal.getByRole('button', {name: 'Save Rule'});
          expect(saveRuleButton).toBeTruthy();
          expect(saveRuleButton).toBeDisabled();

          // Fill sample rate field
          const sampleRateField = modal.getByPlaceholderText('\u0025');
          expect(sampleRateField).toBeTruthy();
          fireEvent.change(sampleRateField, {target: {value: 20}});

          // Save button is now enabled
          const saveRuleButtonEnabled = modal.getByRole('button', {name: 'Save Rule'});
          expect(saveRuleButtonEnabled).toBeEnabled();

          // Click on save button
          fireEvent.click(saveRuleButtonEnabled);

          // Modal will close
          await waitForElementToBeRemoved(() =>
            getByText('Add Transaction Sampling Rule')
          );

          // Transaction rules panel is updated
          expect(queryByText('There are no transaction rules to display')).toBeFalsy();
          const individualTransactionRules = queryAllByText('Individual transactions');
          expect(individualTransactionRules).toHaveLength(1);
          expect(getByText('Legacy Browsers')).toBeTruthy();
          for (const legacyBrowser of legacyBrowsers) {
            const {title} = LEGACY_BROWSER_LIST[legacyBrowser];
            expect(getByText(title)).toBeTruthy();
          }
          expect(getByText('20%')).toBeTruthy();
        });
      });
    });
  });
});
