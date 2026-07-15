import {useEffect, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {InfoTip} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {usePrompt} from 'sentry/actionCreators/prompts';
import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {IconSubscribed} from 'sentry/icons/iconSubscribed';
import {t} from 'sentry/locale';
import {useServiceWorker} from 'sentry/serviceWorker/client/serviceWorkerContext';
import {useNotificationPermission} from 'sentry/serviceWorker/client/useNotificationPermission';
import type {RequestMessage} from 'sentry/serviceWorker/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

const SUCCESS_VISIBLE_DURATION_MS = 25_000;
const PROMPT_FEATURE = 'autofix-sw-notification';

export function SeerEnableNotifications() {
  const organization = useOrganization();
  const [isSuccessVisible, setIsSuccessVisible] = useState(false);
  const {isServiceWorkerSupported, controller} = useServiceWorker();
  const {permission, supportsNotifications, askNotificationPermission} =
    useNotificationPermission();

  const analyticsArea = useAnalyticsArea();

  const {isPromptDismissed, snoozePrompt} = usePrompt({
    feature: PROMPT_FEATURE,
    organization,
  });

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

  useEffect(() => {
    if (!isServiceWorkerSupported || !supportsNotifications || isPromptDismissed) {
      return;
    }
    trackAnalytics('seer-enable-notifications.rendered', {
      organization,
      surface: analyticsArea,
    });
  }, [
    analyticsArea,
    controller,
    isPromptDismissed,
    isServiceWorkerSupported,
    organization,
    supportsNotifications,
  ]);

  if (
    !isServiceWorkerSupported ||
    !supportsNotifications ||
    isPromptDismissed !== false
  ) {
    return null;
  }

  if (isSuccessVisible && permission === 'granted') {
    return (
      <Alert
        variant="success"
        trailingItems={
          <Flex align="center" gap="md">
            <Button
              analyticsEventName="Seer Enable Notifications: Clicked Test Notification"
              analyticsEventKey="seer-enable-notifications.test-notif.clicked"
              analyticsParams={{surface: analyticsArea}}
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
              title={t('Check your OS settings to ensure notifications are allowed')}
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
              analyticsEventName="Seer Enable Notifications: Clicked Notify Me"
              analyticsEventKey="seer-enable-notifications.notify-me.clicked"
              analyticsParams={{surface: analyticsArea}}
              variant="primary"
              size="sm"
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
            <Button
              analyticsEventName="Seer Enable Notifications: Clicked Snooze Prompt"
              analyticsEventKey="seer-enable-notifications.snooze.clicked"
              analyticsParams={{surface: analyticsArea}}
              variant="transparent"
              size="sm"
              onClick={() => snoozePrompt()}
            >
              {t("Don't ask again")}
            </Button>
          </Flex>
        </Flex>
      </Stack>
    );
  }
  return null;
}
