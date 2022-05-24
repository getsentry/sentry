import {
  screen,
  userEvent,
  waitForElementToBeRemoved,
  within,
} from 'sentry-test/reactTestingLibrary';

import {commonConditionCategories, renderComponent, renderModal} from './utils';

describe('Filters and Sampling - Error rule', function () {
  it('edit rule', async function () {
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

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/tags/',
      method: 'GET',
      body: TestStubs.Tags,
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

    expect(screen.getByText('Transaction traces')).toBeInTheDocument();

    const editRuleButtons = screen.getAllByLabelText('Edit Rule');
    expect(editRuleButtons).toHaveLength(2);

    // Open rule modal - edit error rule
    await renderModal(editRuleButtons[0]);

    // Modal content
    expect(screen.getByText('Edit Error Sampling Rule')).toBeInTheDocument();
    expect(screen.queryByText('Tracing')).not.toBeInTheDocument();

    // Release Field
    expect(screen.getByLabelText('Search or add a release')).toBeInTheDocument();

    // Release field is not empty
    const releaseFieldValues = screen.getByTestId('multivalue');
    expect(releaseFieldValues).toBeInTheDocument();
    expect(releaseFieldValues).toHaveTextContent('1*');

    // Button is enabled - meaning the form is valid
    const saveRuleButton = screen.getByLabelText('Save Rule');
    expect(saveRuleButton).toBeInTheDocument();
    expect(saveRuleButton).toBeEnabled();

    // Sample rate field
    const sampleRateField = screen.getByPlaceholderText('\u0025');
    expect(sampleRateField).toBeInTheDocument();

    // Sample rate is not empty
    expect(sampleRateField).toHaveValue(10);

    // Clear release field
    userEvent.clear(screen.getByLabelText('Search or add a release'));

    // Release field is now empty
    expect(screen.queryByTestId('multivalue')).not.toBeInTheDocument();

    expect(screen.getByLabelText('Save Rule')).toBeDisabled();

    // Type into realease field
    userEvent.type(screen.getByLabelText('Search or add a release'), '[I3]');

    // Autocomplete suggests option
    const autocompleteOption = screen.getByTestId('[I3].[0-9]');
    expect(autocompleteOption).toBeInTheDocument();
    expect(autocompleteOption).toHaveTextContent('[I3].[0-9]');

    // Click on the suggested option
    userEvent.click(autocompleteOption);

    expect(screen.getByLabelText('Save Rule')).toBeEnabled();

    // Clear sample rate field
    userEvent.clear(sampleRateField);

    expect(screen.getByLabelText('Save Rule')).toBeDisabled();

    // Update sample rate field
    userEvent.type(sampleRateField, '50');

    // Save button is now enabled
    const saveRuleButtonEnabled = screen.getByLabelText('Save Rule');
    expect(saveRuleButtonEnabled).toBeEnabled();

    // Click on save button
    userEvent.click(saveRuleButtonEnabled);

    // Modal will close
    await waitForElementToBeRemoved(() => screen.queryByText('Edit Error Sampling Rule'));

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

  it('delete rule', async function () {
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
    userEvent.click(screen.getByText('Confirm'));

    // Confirmation modal will close
    await waitForElementToBeRemoved(() =>
      screen.queryByText('Are you sure you wish to delete this dynamic sampling rule?')
    );

    // Error rules panel is updated
    expect(screen.getByText('There are no error rules to display')).toBeInTheDocument();

    // There is still one transaction rule
    expect(transactionTraceRules).toBeInTheDocument();
  });

  describe('modal', function () {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: TestStubs.Project(),
    });

    it('renders modal', async function () {
      renderComponent();

      // Open Modal
      await renderModal(screen.getByText('Add error rule'), true);

      // Modal content
      expect(screen.getByText('Add Error Sampling Rule')).toBeInTheDocument();
      expect(screen.queryByText('Tracing')).not.toBeInTheDocument();
      expect(screen.getByText('Add Condition')).toBeInTheDocument();
      expect(screen.getByText('Apply sampling rate to all errors')).toBeInTheDocument();
      expect(screen.getByText('Sampling Rate \u0025')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('\u0025')).toHaveValue(null);
      expect(screen.getByLabelText('Cancel')).toBeInTheDocument();
      const saveRuleButton = screen.getByLabelText('Save Rule');
      expect(saveRuleButton).toBeInTheDocument();
      expect(saveRuleButton).toBeDisabled();

      // Close Modal
      userEvent.click(screen.getByLabelText('Close Modal'));
      await waitForElementToBeRemoved(() =>
        screen.queryByText('Add Error Sampling Rule')
      );
    });

    it('condition options', async function () {
      renderComponent();

      // Open Modal
      await renderModal(screen.getByText('Add error rule'));

      // Click on 'Add condition'
      userEvent.click(screen.getByText('Add Condition'));

      // Autocomplete
      expect(screen.getByText(/filter conditions/i)).toBeInTheDocument();

      // Condition Options
      const modal = screen.getByRole('dialog');
      commonConditionCategories.forEach(category => {
        expect(within(modal).getByText(category)).toBeInTheDocument();
      });

      // Close Modal
      userEvent.click(screen.getByLabelText('Close Modal'));
      await waitForElementToBeRemoved(() =>
        screen.queryByText('Add Error Sampling Rule')
      );
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
      const autocompleteOption = screen.getByTestId('1.2.3');
      expect(autocompleteOption).toBeInTheDocument();
      expect(autocompleteOption).toHaveTextContent('1.2.3');

      // Click on the suggested option
      userEvent.click(autocompleteOption);

      // Button is still disabled
      const saveRuleButton = screen.getByLabelText('Save Rule');
      expect(saveRuleButton).toBeInTheDocument();
      expect(saveRuleButton).toBeDisabled();

      // Fill sample rate field
      const sampleRateField = screen.getByPlaceholderText('\u0025');
      expect(sampleRateField).toBeInTheDocument();
      userEvent.type(sampleRateField, '20');

      // Save button is now enabled
      const saveRuleButtonEnabled = screen.getByLabelText('Save Rule');
      expect(saveRuleButtonEnabled).toBeEnabled();

      // Click on save button
      userEvent.click(saveRuleButtonEnabled);

      // Modal will close
      await waitForElementToBeRemoved(() =>
        screen.queryByText('Add Error Sampling Rule')
      );

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
});
