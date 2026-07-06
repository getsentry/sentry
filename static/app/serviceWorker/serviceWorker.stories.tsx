import {useEffect, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {useServiceWorker} from 'sentry/serviceWorker/client/serviceWorkerContext';
import {useNotificationPermission} from 'sentry/serviceWorker/client/useNotificationPermission';
import * as Storybook from 'sentry/stories';

export default Storybook.story('ServiceWorker', story => {
  story('Support & Permissions', () => {
    const {permission, supportsNotifications, askNotificationPermission} =
      useNotificationPermission();

    return (
      <Stack gap="md">
        <Text>Notifications Supported?: {supportsNotifications ? 'true' : 'false'}</Text>
        <Text>Notification Permission: {permission}</Text>
        <Flex>
          <Button onClick={() => askNotificationPermission()}>
            Request Notification Permission
          </Button>
        </Flex>
      </Stack>
    );
  });

  story('Controller Request Messages - Outbound', () => {
    const {controller} = useServiceWorker();

    const [outstandingRequests, setOutstandingRequests] = useState<
      Array<[string, unknown]>
    >([]);

    useEffect(() => {
      const interval = setInterval(() => {
        setOutstandingRequests(Array.from(controller._outstandingRequests.entries()));
      }, 1000);
      return () => clearInterval(interval);
    }, [controller._outstandingRequests]);

    return (
      <Stack gap="md">
        <ul>
          {outstandingRequests.map(([messageId, result]) => (
            <li key={messageId}>
              {messageId} = {JSON.stringify(result)}
            </li>
          ))}
        </ul>
      </Stack>
    );
  });

  story('Test Notification', () => {
    const {controller} = useServiceWorker();

    const [responses, setResponses] = useState<unknown[]>([]);
    return (
      <Stack gap="md">
        <Button
          onClick={async () => {
            try {
              const result = await controller.postMessage({
                name: 'trigger.test-notification',
                type: 'request',
                data: {
                  title: 'Test Notification',
                  options: {
                    body: 'You will now receive notifications from Sentry',
                    icon: 'https://sentry.io/favicon.ico',
                    data: {
                      type: 'sentry-notification',
                      url: 'https://sentry.io',
                    },
                    actions: [
                      {
                        action: 'open-sentry',
                        title: 'Open Sentry',
                      },
                      {
                        action: 'next-step',
                        title: 'Next Step',
                      },
                    ],
                  },
                },
              });
              setResponses(prev => [...prev, result]);
            } catch (error) {
              setResponses(prev => [...prev, error]);
            }
          }}
        >
          Send Test Notification
        </Button>

        <pre>{JSON.stringify(responses, null, 2)}</pre>
      </Stack>
    );
  });
});
