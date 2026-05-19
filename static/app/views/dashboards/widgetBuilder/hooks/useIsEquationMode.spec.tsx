import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useNavigate} from 'sentry/utils/useNavigate';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useIsEquationMode} from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEquationMode';

jest.mock('sentry/utils/useNavigate');
const mockedUseNavigate = jest.mocked(useNavigate);

const EQUATION_FEATURES = [
  'tracemetrics-enabled',
  'tracemetrics-equations-in-dashboards',
  'tracemetrics-equations-in-explore',
];

const DASHBOARD_WIDGET_BUILDER_PATHNAME =
  '/organizations/org-slug/dashboards/new/widget/new/';

describe('useIsEquationMode', () => {
  let mockNavigate!: jest.Mock;

  beforeEach(() => {
    mockNavigate = jest.fn();
    mockedUseNavigate.mockReturnValue(mockNavigate);
  });

  afterEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('returns false as initial state for non-tracemetrics dataset', () => {
    const {result} = renderHookWithProviders(() => useIsEquationMode(), {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.SPANS,
            displayType: DisplayType.LINE,
            yAxis: ['count(span.duration)'],
          },
        },
      },
    });

    const [isEquationMode, setIsEquationMode] = result.current;
    expect(isEquationMode).toBe(false);
    expect(typeof setIsEquationMode).toBe('function');
  });

  it('returns [false, setter] when feature flag is disabled', () => {
    const {result} = renderHookWithProviders(() => useIsEquationMode(), {
      organization: OrganizationFixture({features: []}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: ['sum(value,alpha_metric,counter,-)'],
          },
        },
      },
    });

    expect(result.current[0]).toBe(false);
  });

  it('returns false as initial state when yAxis has no equations', () => {
    const {result} = renderHookWithProviders(() => useIsEquationMode(), {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: ['sum(value,alpha_metric,counter,-)'],
          },
        },
      },
    });

    expect(result.current[0]).toBe(false);
  });

  it('returns true as initial state when yAxis contains an equation', () => {
    const {result} = renderHookWithProviders(() => useIsEquationMode(), {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: [
              'equation|sum(value,alpha_metric,counter,-) + avg(value,beta_metric,counter,-)',
            ],
          },
        },
      },
    });

    expect(result.current[0]).toBe(true);
  });
});
