import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import AlertsContainer from 'sentry/views/alerts';

describe('AlertsContainer', () => {
  function SubView({hasMetricAlerts}: {hasMetricAlerts?: boolean}) {
    return <div>{hasMetricAlerts ? 'access' : 'no access'}</div>;
  }

  describe('no access without feature flag', () => {
    it('display no access message', () => {
      const organization = OrganizationFixture();

      render(
        <AlertsContainer>
          <SubView />
        </AlertsContainer>,
        {
          organization,
        }
      );
      expect(screen.getByText('no access')).toBeInTheDocument();
    });

    it('allows access', () => {
      const organization = OrganizationFixture({
        features: ['incidents'],
      });

      render(
        <AlertsContainer>
          <SubView />
        </AlertsContainer>,
        {
          organization,
        }
      );
      expect(screen.getByText('access')).toBeInTheDocument();
    });
  });
});
