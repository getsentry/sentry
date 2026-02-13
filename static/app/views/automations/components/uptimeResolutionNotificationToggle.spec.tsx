import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import type {AutomationBuilderState} from 'sentry/views/automations/components/automationBuilderContext';
import {AutomationBuilderContext} from 'sentry/views/automations/components/automationBuilderContext';
import {UptimeResolutionNotificationToggle} from 'sentry/views/automations/components/uptimeResolutionNotificationToggle';

jest.mock('sentry/views/automations/hooks/useConnectedDetectors', () => ({
  useConnectedDetectors: jest.fn(),
}));

const mockUseConnectedDetectors = require('sentry/views/automations/hooks/useConnectedDetectors')
  .useConnectedDetectors as jest.Mock;

describe('UptimeResolutionNotificationToggle', () => {
  const mockActions = {
    addWhenCondition: jest.fn(),
    removeWhenCondition: jest.fn(),
    updateWhenCondition: jest.fn(),
    updateWhenLogicType: jest.fn(),
    addIf: jest.fn(),
    removeIf: jest.fn(),
    addIfCondition: jest.fn(),
    removeIfCondition: jest.fn(),
    updateIfCondition: jest.fn(),
    addIfAction: jest.fn(),
    removeIfAction: jest.fn(),
    updateIfAction: jest.fn(),
    updateIfLogicType: jest.fn(),
  };

  const mockState: AutomationBuilderState = {
    triggers: {
      id: 'when',
      logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
      conditions: [],
    },
    actionFilters: [],
  };

  const renderComponent = (
    state: AutomationBuilderState = mockState,
    detectors: any[] = []
  ) => {
    mockUseConnectedDetectors.mockReturnValue({
      connectedDetectors: detectors,
      isLoading: false,
    });

    return render(
      <AutomationBuilderContext.Provider
        value={{
          state,
          actions: mockActions,
          showTriggerLogicTypeSelector: false,
        }}
      >
        <UptimeResolutionNotificationToggle />
      </AutomationBuilderContext.Provider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render when no uptime detectors are connected', () => {
    const {container} = renderComponent(mockState, []);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when only non-uptime detectors are connected', () => {
    const {container} = renderComponent(mockState, [
      {id: '1', type: 'metric_issue', name: 'Metric Detector'},
    ]);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders guidance message when uptime detector is connected but no resolution filter exists', () => {
    renderComponent(mockState, [
      {id: '1', type: 'uptime_domain_failure', name: 'Uptime Monitor'},
    ]);

    expect(
      screen.getByText('Want to be notified when uptime monitor outages are resolved?')
    ).toBeInTheDocument();
    expect(screen.getByText(/Add an If\/Then block with the/, {exact: false})).toBeInTheDocument();
  });

  it('renders success message when resolution filter is configured', () => {
    const stateWithResolution: AutomationBuilderState = {
      ...mockState,
      actionFilters: [
        {
          id: 'filter-1',
          logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
          conditions: [
            {
              id: 'cond-1',
              type: DataConditionType.ISSUE_PRIORITY_DEESCALATING,
              comparison: 75,
            },
          ],
          actions: [],
        },
      ],
    };

    renderComponent(stateWithResolution, [
      {id: '1', type: 'uptime_domain_failure', name: 'Uptime Monitor'},
    ]);

    expect(
      screen.getByText('Resolution notifications are configured')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'This automation will send notifications when uptime monitor outages are resolved.'
      )
    ).toBeInTheDocument();
  });

  it('renders for mixed detector types when at least one is uptime', () => {
    renderComponent(mockState, [
      {id: '1', type: 'metric_issue', name: 'Metric Detector'},
      {id: '2', type: 'uptime_domain_failure', name: 'Uptime Monitor'},
      {id: '3', type: 'error', name: 'Error Detector'},
    ]);

    expect(
      screen.getByText('Want to be notified when uptime monitor outages are resolved?')
    ).toBeInTheDocument();
  });
});
