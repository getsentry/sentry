import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import GlobalModal from 'sentry/components/globalModal';
import {
  SamplingConditionOperator,
  SamplingInnerName,
  SamplingInnerOperator,
  SamplingRule,
  SamplingRuleType,
} from 'sentry/types/sampling';
import {SpecificConditionsModal} from 'sentry/views/settings/project/server-side-sampling/modals/specificConditionsModal';
import {distributedTracesConditions} from 'sentry/views/settings/project/server-side-sampling/modals/specificConditionsModal/utils';
import {getInnerNameLabel} from 'sentry/views/settings/project/server-side-sampling/utils';

import {getMockData, uniformRule} from '../utils';

describe('Server-side Sampling - Specific Conditions Modal', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/release/values/',
      method: 'GET',
      body: [{value: '1.2.3'}],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('add new rule', async function () {
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
      id: 0,
      sampleRate: 0.2,
      type: 'trace',
      active: false,
    };

    const saveMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: TestStubs.Project({
        dynamicSampling: {
          rules: [uniformRule, newRule],
        },
      }),
    });

    jest.spyOn(indicators, 'addSuccessMessage');

    render(<GlobalModal />);

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
        'Using a Trace ID, select all Transactions distributed across multiple projects/services which match your conditions.'
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

    // Dialog should close
    await waitForElementToBeRemoved(() => screen.queryByText('Save Rule'));

    expect(saveMock).toHaveBeenCalledTimes(1);

    expect(saveMock).toHaveBeenLastCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({
        data: {
          dynamicSampling: {
            rules: [uniformRule, newRule],
          },
        },
      })
    );

    expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
      'Successfully added sampling rule'
    );
  });

  it('edits the rule', async function () {
    const specificRule: SamplingRule = {
      sampleRate: 0.2,
      active: false,
      type: SamplingRuleType.TRACE,
      condition: {
        op: SamplingConditionOperator.AND,
        inner: [
          {
            op: SamplingInnerOperator.GLOB_MATCH,
            name: 'trace.release',
            value: ['1.2.2'],
          },
        ],
      },
      id: 2,
    };

    const {organization, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [uniformRule, specificRule],
          },
        }),
      ],
    });

    const newRule = {
      ...specificRule,
      id: 0,
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
          rules: [uniformRule, newRule],
        },
      }),
    });

    jest.spyOn(indicators, 'addSuccessMessage');

    render(<GlobalModal />);

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

    // Type into realease field
    userEvent.clear(screen.getByLabelText('Search or add a release'));
    userEvent.paste(screen.getByLabelText('Search or add a release'), '1.2.3');
    userEvent.keyboard('{enter}');

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
            rules: [uniformRule, newRule],
          },
        },
      })
    );

    expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
      'Successfully edited sampling rule'
    );
  });
});
