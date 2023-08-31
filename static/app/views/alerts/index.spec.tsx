import {render, screen} from 'sentry-test/reactTestingLibrary';

import TeamStore from 'sentry/stores/teamStore';
import AlertsContainer from 'sentry/views/alerts';

describe('AlertsContainer', function () {
  beforeEach(() => {
    const team = TestStubs.Team({slug: 'team-slug', isMember: true});
    TeamStore.loadInitialData([{...team, access: ['team:read']}]);
  });

  function SubView({hasMetricAlerts}: {hasMetricAlerts?: boolean}) {
    return <div>{hasMetricAlerts ? 'access' : 'no access'}</div>;
  }

  describe('no access without feature flag', function () {
    it('display no access message', function () {
      const organization = TestStubs.Organization();

      render(
        <AlertsContainer>
          <SubView />
        </AlertsContainer>,
        {
          context: TestStubs.routerContext([{organization}]),
          organization,
        }
      );
      expect(screen.getByText('no access')).toBeInTheDocument();
    });

    it('allows access', function () {
      const organization = TestStubs.Organization({
        features: ['incidents'],
      });

      render(
        <AlertsContainer>
          <SubView />
        </AlertsContainer>,
        {
          context: TestStubs.routerContext([{organization}]),
          organization,
        }
      );
      expect(screen.getByText('access')).toBeInTheDocument();
    });
  });
});
