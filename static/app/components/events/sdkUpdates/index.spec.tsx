import {Event as EventFixture} from 'sentry-fixture/event';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import {EventSdkUpdates} from 'sentry/components/events/sdkUpdates';

describe('EventSdkUpdates', function () {
  const {routerContext} = initializeOrg();

  it('renders a suggestion to update the sdk and then enable an integration', function () {
    const event = EventFixture({
      id: '123',
      sdk: {
        name: 'sentry.python',
        version: '0.1.0',
      },
      sdkUpdates: [
        {
          enables: [
            {
              type: 'enableIntegration',
              enables: [],
              integrationName: 'django',
              integrationUrl: 'https://docs.sentry.io/platforms/python/guides/django/',
            },
          ],
          newSdkVersion: '0.9.0',
          sdkName: 'sentry.python',
          sdkUrl: null,
          type: 'updateSdk',
        },
      ],
    });

    render(<EventSdkUpdates event={event} />, {context: routerContext});
  });
});
