import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

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

  story('Test Notification', () => {
    const {controller} = useServiceWorker();

    const [responses, setResponses] = useState<unknown[]>([]);
    return (
      <Stack gap="md">
        <Flex>
          <Button
            onClick={async () => {
              try {
                const result = await controller.postMessage({
                  name: 'trigger.test-notification',
                  type: 'request',
                  timeoutMs: 1_000,
                  data: {
                    title: 'Test Notification',
                    options: {
                      body: 'This is only a test!',
                      icon: 'https://sentry.io/favicon.ico',
                      badge: 'https://sentry.io/favicon.ico',
                      image: 'https://sentry.io/favicon.ico',
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
        </Flex>

        <Heading as="h4">Responses</Heading>
        <pre>{JSON.stringify(responses, null, 2)}</pre>
      </Stack>
    );
  });
});
