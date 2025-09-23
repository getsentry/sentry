import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PreventContext} from 'sentry/components/prevent/context/preventContext';
import TestAnalyticsTable from 'sentry/views/prevent/tests/testAnalyticsTable/testAnalyticsTable';

const mockTestResults = [
  {
    testName:
      'tests.symbolicator.test_unreal_full.SymbolicatorUnrealIntegrationTest::test_unreal_crash_with_attachments',
    averageDurationMs: 4,
    flakeRate: 0.4,
    isBrokenTest: false,
    lastRun: '2025-04-17T22:26:19.486793+00:00',
    totalFailCount: 1,
    totalFlakyFailCount: 2,
    totalPassCount: 0,
    totalSkipCount: 3,
    updatedAt: '2025-04-17T22:26:19.486793+00:00',
  },
];

const mockResponse = {
  data: {
    testResults: mockTestResults,
    defaultBranch: 'main',
  },
  isLoading: false,
};

const mockSort = {
  field: 'averageDurationMs' as const,
  kind: 'asc' as const,
};

const mockPreventContext = {
  repository: 'test-repo',
  changeContextValue: jest.fn(),
  preventPeriod: '7d',
  branch: 'main',
  integratedOrgId: '123',
  lastVisitedOrgId: '123',
};

describe('TestAnalyticsTable', () => {
  describe('when selectedBranch is null', () => {
    const nullBranchContext = {
      ...mockPreventContext,
      branch: null,
    };

    it('treats null branch as main/default branch and displays "Flake Rate"', () => {
      render(
        <PreventContext.Provider value={nullBranchContext}>
          <TestAnalyticsTable response={mockResponse} sort={mockSort} />
        </PreventContext.Provider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tests',
              query: {},
            },
          },
        }
      );

      expect(screen.getByText('Flake Rate')).toBeInTheDocument();
    });
  });

  describe('when selectedBranch matches defaultBranch', () => {
    const matchingBranchContext = {
      ...mockPreventContext,
      branch: 'main',
    };

    it('treats matching branch as main/default branch and displays "Flake Rate"', () => {
      render(
        <PreventContext.Provider value={matchingBranchContext}>
          <TestAnalyticsTable response={mockResponse} sort={mockSort} />
        </PreventContext.Provider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tests',
              query: {},
            },
          },
        }
      );

      expect(screen.getByText('Flake Rate')).toBeInTheDocument();
    });
  });

  describe('when defaultBranch is undefined', () => {
    const responseWithoutDefaultBranch = {
      data: {
        testResults: mockTestResults,
      },
      isLoading: false,
    };

    it('treats any branch as non-main when defaultBranch is undefined', () => {
      render(
        <PreventContext.Provider value={mockPreventContext}>
          <TestAnalyticsTable response={responseWithoutDefaultBranch} sort={mockSort} />
        </PreventContext.Provider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tests',
              query: {},
            },
          },
        }
      );

      expect(screen.getByText('Failure Rate')).toBeInTheDocument();
    });
  });
});
