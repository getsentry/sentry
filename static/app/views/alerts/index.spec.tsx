import {Organization} from 'sentry-fixture/organization';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import AlertsContainer from 'sentry/views/alerts';

describe('AlertsContainer', function () {
  function SubView({hasMetricAlerts}: {hasMetricAlerts?: boolean}) {
    return <div>{hasMetricAlerts ? 'access' : 'no access'}</div>;
  }

  describe('no access without feature flag', function () {
    it('display no access message', function () {
      const organization = Organization();

      render(
        <AlertsContainer>
          <SubView />
        </AlertsContainer>,
        {
          context: RouterContextFixture([{organization}]),
          organization,
        }
      );
      expect(screen.getByText('no access')).toBeInTheDocument();
    });

    it('allows access', function () {
      const organization = Organization({
        features: ['incidents'],
      });

      render(
        <AlertsContainer>
          <SubView />
        </AlertsContainer>,
        {
          context: RouterContextFixture([{organization}]),
          organization,
        }
      );
      expect(screen.getByText('access')).toBeInTheDocument();
    });
  });
});
