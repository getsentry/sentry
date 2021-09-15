import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import TeamInsightsContainer from 'app/views/teamInsights';

describe('TeamInsightsContainer', () => {
  it('blocks access if org is missing flag', () => {
    // @ts-expect-error
    const organization = TestStubs.Organization();
    // @ts-expect-error
    const context = TestStubs.routerContext([{organization}]);
    const wrapper = mountWithTheme(
      <TeamInsightsContainer organization={organization}>
        <div>test</div>
      </TeamInsightsContainer>,
      {context}
    );

    expect(wrapper.queryByText('test')).toBeNull();
  });
  it('allows access for orgs with flag', () => {
    // @ts-expect-error
    const organization = TestStubs.Organization({features: ['team-insights']});
    // @ts-expect-error
    const context = TestStubs.routerContext([{organization}]);
    const wrapper = mountWithTheme(
      <TeamInsightsContainer organization={organization}>
        <div>test</div>
      </TeamInsightsContainer>,
      {context}
    );

    expect(wrapper.getByText('test')).toBeTruthy();
  });
});
