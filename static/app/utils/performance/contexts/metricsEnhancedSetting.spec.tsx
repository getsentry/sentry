import {LocationFixture} from 'sentry-fixture/locationFixture';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {MEPSettingProvider} from './metricsEnhancedSetting';
import {MEPState, useMEPSettingContext} from './useMEPSettingContext';

function MEPSettingControls() {
  const {metricSettingState, setMetricSettingState} = useMEPSettingContext();
  return (
    <button onClick={() => setMetricSettingState(MEPState.TRANSACTIONS_ONLY)}>
      {metricSettingState}
    </button>
  );
}

describe('MEPSettingProvider', () => {
  it('reads the initial setting from the URL when given a location', () => {
    render(
      <MEPSettingProvider location={LocationFixture()}>
        <MEPSettingControls />
      </MEPSettingProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/performance/',
            query: {metricSetting: 'transactionsOnly'},
          },
        },
      }
    );

    expect(screen.getByRole('button')).toHaveTextContent(MEPState.TRANSACTIONS_ONLY);
  });

  it('ignores the URL setting when not given a location', () => {
    render(
      <MEPSettingProvider>
        <MEPSettingControls />
      </MEPSettingProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/performance/',
            query: {metricSetting: 'transactionsOnly'},
          },
        },
      }
    );

    expect(screen.getByRole('button')).toHaveTextContent(MEPState.METRICS_ONLY);
  });

  it('replaces the URL setting when the setting changes', async () => {
    const {router} = render(
      <MEPSettingProvider location={LocationFixture()}>
        <MEPSettingControls />
      </MEPSettingProvider>,
      {
        initialRouterConfig: {
          location: {pathname: '/performance/', query: {project: '1'}},
        },
      }
    );
    router.navigate('/performance/?project=2');

    await userEvent.click(await screen.findByRole('button'));
    await waitFor(() =>
      expect(router.location.query).toEqual({
        project: '2',
        metricSetting: MEPState.TRANSACTIONS_ONLY,
      })
    );
    router.navigate(-1);

    await waitFor(() => expect(router.location.query).toEqual({project: '1'}));
    expect(screen.getByRole('button')).toHaveTextContent(MEPState.TRANSACTIONS_ONLY);
  });
});
