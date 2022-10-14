import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {SamplingInnerName} from 'sentry/types/sampling';
import {SpecificConditionsModal} from 'sentry/views/settings/project/server-side-sampling/modals/specificConditionsModal';
import {distributedTracesConditions} from 'sentry/views/settings/project/server-side-sampling/modals/specificConditionsModal/utils';
import {getInnerNameLabel} from 'sentry/views/settings/project/server-side-sampling/utils';

import {getMockData, specificRule, uniformRule} from '../../testUtils';

describe('Server-Side Sampling - Specific Conditions Modal', function () {
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('add new rule', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/release/values/',
      method: 'GET',
      body: [{value: '1.2.3', count: 97}],
    });

    const {organization, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [uniformRule],
          },
        }),
      ],
    });

    const newRule = {
      condition: {
        inner: [{name: 'trace.release', op: 'glob', value: ['1.2.3']}],
        op: 'and',
      },
      id: -1,
      sampleRate: 0.2,
      type: 'trace',
      active: false,
    };

    const saveMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: TestStubs.Project({
        dynamicSampling: {
          rules: [newRule, uniformRule],
        },
      }),
    });

    jest.spyOn(indicators, 'addSuccessMessage');

    renderGlobalModal();

    openModal(modalProps => (
      <SpecificConditionsModal
        {...modalProps}
        organization={organization}
        project={project}
        rules={[uniformRule]}
      />
    ));

    // Dialog Header
    expect(screen.getByRole('heading', {name: 'Add Rule'})).toBeInTheDocument();

    // Dialog Content
    expect(
      screen.getByText(
        'Sample transactions under specific conditions. Multiple conditions are logically expressed as AND and OR for multiple values.'
      )
    ).toBeInTheDocument();

    expect(screen.getByText('No conditions added')).toBeInTheDocument();

    expect(
      screen.getByText('Click on the button above to add (+) a condition')
    ).toBeInTheDocument();

    expect(screen.getByPlaceholderText('\u0025')).toHaveTextContent('');

    // Dialog Footer
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Save Rule'})).toBeDisabled();

    userEvent.hover(screen.getByText('Save Rule'));

    expect(
      await screen.findByText('Required fields must be filled out')
    ).toBeInTheDocument();

    // Click on 'Add condition'
    userEvent.click(screen.getByText('Add Condition'));

    // Autocomplete
    expect(screen.getByText(/filter conditions/i)).toBeInTheDocument();

    // Distributed Traces Options
    distributedTracesConditions.forEach(condition => {
      expect(screen.getByText(getInnerNameLabel(condition))).toBeInTheDocument();
    });

    // Click on the condition option
    userEvent.click(screen.getByText(getInnerNameLabel(SamplingInnerName.TRACE_RELEASE)));

    // Release field is empty
    expect(screen.queryByTestId('multivalue')).not.toBeInTheDocument();

    // Type the release version into release field
    userEvent.paste(screen.getByLabelText('Search or add a release'), '1.2');

    // Autocomplete suggests options
    expect(await screen.findByTestId('1.2.3')).toHaveTextContent('1.2.3');

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

    // Dialog should close
    await waitForElementToBeRemoved(() => screen.queryByText('Save Rule'));

    expect(saveMock).toHaveBeenCalledTimes(1);

    expect(saveMock).toHaveBeenLastCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({
        data: {
          dynamicSampling: {
            rules: [newRule, uniformRule],
          },
        },
      })
    );

    expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
      'Successfully added sampling rule'
    );
  });

  it('edits specific rule', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/release/values/',
      method: 'GET',
      body: [{value: '1.2.3'}],
    });

    const {organization, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [specificRule, uniformRule],
          },
        }),
      ],
    });

    const newRule = {
      ...specificRule,
      id: -1,
      sampleRate: 0.6,
      condition: {
        ...specificRule.condition,
        inner: [
          {
            ...specificRule.condition.inner[0],
            value: ['1.2.3'],
          },
        ],
      },
    };

    const saveMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: TestStubs.Project({
        dynamicSampling: {
          rules: [newRule, uniformRule],
        },
      }),
    });

    jest.spyOn(indicators, 'addSuccessMessage');

    renderGlobalModal();

    openModal(modalProps => (
      <SpecificConditionsModal
        {...modalProps}
        organization={organization}
        project={project}
        rule={specificRule}
        rules={[uniformRule, specificRule]}
      />
    ));

    expect(screen.getByRole('heading', {name: 'Edit Rule'})).toBeInTheDocument();

    // Empty conditions message is not displayed
    expect(screen.queryByText('No conditions added')).not.toBeInTheDocument();

    // Type into release field
    userEvent.clear(screen.getByLabelText('Search or add a release'));
    userEvent.paste(screen.getByLabelText('Search or add a release'), '1.2');

    // Click on the suggested option
    userEvent.click(await screen.findByTestId('1.2.3'));

    // Update sample rate field
    userEvent.clear(screen.getByPlaceholderText('\u0025'));
    userEvent.paste(screen.getByPlaceholderText('\u0025'), '60');

    // Click on save button
    userEvent.click(screen.getByRole('button', {name: 'Save Rule'}));

    // Modal will close
    await waitForElementToBeRemoved(() => screen.queryByText('Save Rule'));

    expect(saveMock).toHaveBeenCalledTimes(1);

    expect(saveMock).toHaveBeenLastCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({
        data: {
          dynamicSampling: {
            rules: [newRule, uniformRule],
          },
        },
      })
    );

    expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
      'Successfully edited sampling rule'
    );
  });

  it('uniform rules are always submit in the last place', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/environment/values/',
      method: 'GET',
      body: [{value: 'prod'}],
    });

    const newRule = {
      condition: {
        inner: [
          {
            name: 'trace.environment',
            op: 'eq',
            value: ['prod'],
            options: {ignoreCase: true},
          },
        ],
        op: 'and',
      },
      id: -1,
      sampleRate: 0.5,
      type: 'trace',
      active: false,
    };

    const {organization, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [specificRule, uniformRule],
          },
        }),
      ],
    });

    const saveMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: TestStubs.Project({
        dynamicSampling: {
          rules: [specificRule, newRule, uniformRule],
        },
      }),
    });

    renderGlobalModal();

    openModal(modalProps => (
      <SpecificConditionsModal
        {...modalProps}
        organization={organization}
        project={project}
        rules={[specificRule, uniformRule]}
      />
    ));

    // Click on 'Add condition'
    userEvent.click(screen.getByText('Add Condition'));

    // Click on the condition option
    userEvent.click(
      screen.getByText(getInnerNameLabel(SamplingInnerName.TRACE_ENVIRONMENT))
    );

    // Type into environment field
    userEvent.paste(screen.getByLabelText('Search or add an environment'), 'pro');

    // Click on the suggested option
    userEvent.click(await screen.findByTestId('prod'));

    // Fill sample rate field
    userEvent.paste(screen.getByPlaceholderText('\u0025'), '50');

    // Click on save button
    userEvent.click(screen.getByLabelText('Save Rule'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenLastCalledWith(
        '/projects/org-slug/project-slug/',
        expect.objectContaining({
          data: {
            dynamicSampling: {
              rules: [specificRule, newRule, uniformRule],
            },
          },
        })
      );
    });
  });

  it('autocomplete force reload options', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/release/values/',
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/environment/values/',
      method: 'GET',
      body: [{value: 'staging', count: 97}],
    });

    const {organization, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [uniformRule],
          },
        }),
      ],
    });

    renderGlobalModal();

    openModal(modalProps => (
      <SpecificConditionsModal
        {...modalProps}
        organization={organization}
        project={project}
        rules={[uniformRule]}
      />
    ));

    // Click on 'Add condition'
    userEvent.click(screen.getByText('Add Condition'));

    // Add conditions
    userEvent.click(
      screen.getByText(getInnerNameLabel(SamplingInnerName.TRACE_ENVIRONMENT))
    );

    userEvent.click(screen.getByText(getInnerNameLabel(SamplingInnerName.TRACE_RELEASE)));

    // Click on the environment condition option
    userEvent.paste(screen.getByLabelText('Search or add an environment'), 's');

    // Environment condition has options
    expect(await screen.findByText('staging')).toBeInTheDocument();

    // Click on the release condition option
    userEvent.click(screen.getByLabelText('Search or add a release'));

    // Release condition has no options
    await waitFor(() => {
      expect(screen.queryByTestId('multivalue')).not.toBeInTheDocument();
    });

    userEvent.click(screen.getAllByLabelText('Delete Condition')[0]);

    // Click on the release condition option
    userEvent.click(screen.getByLabelText('Search or add a release'));

    // Release condition has no environment options
    expect(screen.queryByText('staging')).not.toBeInTheDocument();
  });
});
