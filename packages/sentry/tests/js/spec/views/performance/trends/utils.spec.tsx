import {TrendColumnField} from 'sentry/views/performance/trends/types';
import {
  getCurrentTrendParameter,
  performanceTypeToTrendParameterLabel,
} from 'sentry/views/performance/trends/utils';
import {PROJECT_PERFORMANCE_TYPE} from 'sentry/views/performance/utils';

describe('Trend parameter utils', function () {
  describe('performanceTypeToTrendParameterLabel', function () {
    it('returns correct trend parameter label based on performance type', function () {
      const lcp = {
        label: 'LCP',
        column: TrendColumnField.LCP,
      };

      const duration = {
        label: 'Duration',
        column: TrendColumnField.DURATION,
      };

      const frontendProjectOutput = performanceTypeToTrendParameterLabel(
        PROJECT_PERFORMANCE_TYPE.FRONTEND
      );
      expect(frontendProjectOutput).toEqual(lcp);

      const anyProjectOutput = performanceTypeToTrendParameterLabel(
        PROJECT_PERFORMANCE_TYPE.ANY
      );
      expect(anyProjectOutput).toEqual(duration);

      const backendProjectOutput = performanceTypeToTrendParameterLabel(
        PROJECT_PERFORMANCE_TYPE.BACKEND
      );
      expect(backendProjectOutput).toEqual(duration);

      const frontendOtherProjectOutput = performanceTypeToTrendParameterLabel(
        PROJECT_PERFORMANCE_TYPE.FRONTEND_OTHER
      );
      expect(frontendOtherProjectOutput).toEqual(duration);

      const mobileProjectOutput = performanceTypeToTrendParameterLabel(
        PROJECT_PERFORMANCE_TYPE.MOBILE
      );
      expect(mobileProjectOutput).toEqual(duration);
    });
  });

  describe('getCurrentTrendParameter', function () {
    it('returns trend parameter from location', () => {
      const location = TestStubs.location({query: {trendParameter: 'FCP'}});
      const expectedTrendParameter = {
        label: 'FCP',
        column: TrendColumnField.FCP,
      };
      // project with performance type 'any'
      const projects = [TestStubs.Project({id: 1, platform: null})];

      const output = getCurrentTrendParameter(location, projects, [1]);
      expect(output).toEqual(expectedTrendParameter);
    });

    it('returns default trend parameter based on project type if no trend parameter set in location', function () {
      const location = TestStubs.location();
      const expectedTrendParameter = {
        label: 'Duration',
        column: TrendColumnField.DURATION,
      };
      // project with performance type 'any'
      const projects = [TestStubs.Project({id: 1, platform: null})];

      const output = getCurrentTrendParameter(location, projects, [1]);
      expect(output).toEqual(expectedTrendParameter);
    });
  });
});
