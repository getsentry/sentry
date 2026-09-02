import {DataConditionFixture} from 'sentry-fixture/automations';
import {EnvironmentsFixture} from 'sentry-fixture/environments';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import {LatestAdoptedReleaseNode} from 'sentry/views/automations/components/actionFilters/latestAdoptedRelease';
import {AutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import {DataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

describe('LatestAdoptedReleaseNode', () => {
  const organization = OrganizationFixture();
  const condition = DataConditionFixture({
    id: 'latest-adopted-release',
    type: DataConditionType.LATEST_ADOPTED_RELEASE,
    comparison: {
      releaseAgeType: 'oldest',
      ageComparison: 'newer',
      environment: '',
    },
  });
  const onUpdate = jest.fn();
  const removeError = jest.fn();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/environments/`,
      body: EnvironmentsFixture(),
    });
  });

  it('stores the environment name when selected', async () => {
    render(
      <AutomationBuilderErrorContext.Provider
        value={{
          errors: {},
          mutationErrors: undefined,
          setErrors: jest.fn(),
          removeError,
        }}
      >
        <DataConditionNodeContext.Provider
          value={{
            condition,
            condition_id: condition.id,
            onUpdate,
          }}
        >
          <LatestAdoptedReleaseNode />
        </DataConditionNodeContext.Provider>
      </AutomationBuilderErrorContext.Provider>,
      {organization}
    );

    const environmentSelect = await screen.findByRole('textbox', {
      name: 'Environment',
    });
    await userEvent.click(environmentSelect);
    await userEvent.click(
      screen.getByRole('menuitemradio', {
        name: 'production',
      })
    );

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        comparison: {
          ...condition.comparison,
          environment: 'production',
        },
      });
    });
    expect(removeError).toHaveBeenCalledWith(condition.id);
  });
});
