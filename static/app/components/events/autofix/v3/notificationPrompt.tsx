import {useEffect, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {InfoTip} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {IconSubscribed} from 'sentry/icons/iconSubscribed';
import {t} from 'sentry/locale';
import {useServiceWorker} from 'sentry/serviceWorker/client/serviceWorkerContext';
import {useNotificationPermission} from 'sentry/serviceWorker/client/useNotificationPermission';
import type {RequestMessage} from 'sentry/serviceWorker/types';

const SUCCESS_VISIBLE_DURATION_MS = 25_000;
export function NotificationPrompt() {
  const [isSuccessVisible, setIsSuccessVisible] = useState(false);
  const {isServiceWorkerSupported, controller} = useServiceWorker();
  const {permission, supportsNotifications, askNotificationPermission} =
    useNotificationPermission();

  useEffect(() => {
    if (isSuccessVisible && permission === 'granted') {
      const timeout = setTimeout(
        () => setIsSuccessVisible(false),
        SUCCESS_VISIBLE_DURATION_MS
      );
      return () => clearTimeout(timeout);
    }
    return () => {};
  }, [isSuccessVisible, permission]);

  if (!isServiceWorkerSupported || !supportsNotifications) {
    return null;
  }

  if (isSuccessVisible && permission === 'granted') {
    return (
      <Alert
        variant="success"
        trailingItems={
          <Flex align="center" gap="md">
            <Button
              size="xs"
              onClick={async () => {
                try {
                  await controller.postMessage({
                    name: 'trigger.test-notification',
                    type: 'request',
                    data: {
                      title: 'Seer Test Notification',
                      options: {
                        body: 'Seer will notify you when it has an update',
                        icon: 'https://sentry.io/favicon.ico',
                        badge: 'https://sentry.io/favicon.ico',
                        image: 'https://sentry.io/favicon.ico',
                      },
                    },
                  } satisfies RequestMessage);
                } catch (error) {
                  addErrorMessage(error instanceof Error ? error.message : String(error));
                }
              }}
            >
              {t('Send a test notification')}
            </Button>
            <InfoTip
              title={t('Check your OS settings to ensure notifications are delivered')}
            />
          </Flex>
        }
      >
        <Text>{t('Notifications are enabled')}</Text>
      </Alert>
    );
  }

  if (permission === 'default') {
    return (
      <Stack gap="lg" justify="center" align="center">
        <Text>{t('Get a notification when Seer has an update')}</Text>

        <Flex gap="lg" align="center">
          <Flex align="center" gap="md">
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                askNotificationPermission().then(() => {
                  setIsSuccessVisible(true);
                });
              }}
              icon={<IconSubscribed />}
            >
              {t("Notify me when it's ready")}
            </Button>
          </Flex>
          <Flex>
            <Button variant="transparent" size="md">
              {t("Don't ask again")}
            </Button>
          </Flex>
        </Flex>
      </Stack>
    );
  }
  return null;
}
