import {LocationFixture} from 'sentry-fixture/locationFixture';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {
  TrendParameterColumn,
  TrendParameterLabel,
} from 'sentry/views/performance/trends/types';
import {
  getCurrentTrendParameter,
  performanceTypeToTrendParameterLabel,
} from 'sentry/views/performance/trends/utils';
import {ProjectPerformanceType} from 'sentry/views/performance/utils';

describe('Trend parameter utils', function () {
  describe('performanceTypeToTrendParameterLabel', function () {
    it('returns correct trend parameter label based on performance type', function () {
      const lcp = {
        label: TrendParameterLabel.LCP,
        column: TrendParameterColumn.LCP,
      };

      const duration = {
        label: TrendParameterLabel.DURATION,
        column: TrendParameterColumn.DURATION,
      };

      const frontendProjectOutput = performanceTypeToTrendParameterLabel(
        ProjectPerformanceType.FRONTEND
      );
      expect(frontendProjectOutput).toEqual(lcp);

      const anyProjectOutput = performanceTypeToTrendParameterLabel(
        ProjectPerformanceType.ANY
      );
      expect(anyProjectOutput).toEqual(duration);

      const backendProjectOutput = performanceTypeToTrendParameterLabel(
        ProjectPerformanceType.BACKEND
      );
      expect(backendProjectOutput).toEqual(duration);

      const frontendOtherProjectOutput = performanceTypeToTrendParameterLabel(
        ProjectPerformanceType.FRONTEND_OTHER
      );
      expect(frontendOtherProjectOutput).toEqual(duration);

      const mobileProjectOutput = performanceTypeToTrendParameterLabel(
        ProjectPerformanceType.MOBILE
      );
      expect(mobileProjectOutput).toEqual(duration);
    });
  });

  describe('getCurrentTrendParameter', function () {
    it('returns trend parameter from location', () => {
      const location = LocationFixture({query: {trendParameter: 'FCP'}});
      const expectedTrendParameter = {
        label: TrendParameterLabel.FCP,
        column: TrendParameterColumn.FCP,
      };
      // project with performance type 'any'
      const projects = [ProjectFixture({id: '1', platform: undefined})];

      const output = getCurrentTrendParameter(location, projects, [1]);
      expect(output).toEqual(expectedTrendParameter);
    });

    it('returns default trend parameter based on project type if no trend parameter set in location', function () {
      const location = LocationFixture();
      const expectedTrendParameter = {
        label: TrendParameterLabel.DURATION,
        column: TrendParameterColumn.DURATION,
      };
      // project with performance type 'any'
      const projects = [ProjectFixture({id: '1', platform: undefined})];

      const output = getCurrentTrendParameter(location, projects, [1]);
      expect(output).toEqual(expectedTrendParameter);
    });
  });
});
