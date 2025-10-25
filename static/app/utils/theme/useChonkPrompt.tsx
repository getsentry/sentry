import {useEffect} from 'react';
import moment from 'moment-timezone';

import {usePrompt, type PromptResponse} from 'sentry/actionCreators/prompts';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

function noop() {}

const DAYS_SINCE_DISMISS = 7;

function promptWasDismissedWithoutSnoozing(
  promptData: PromptResponse['data'],
  daysSinceDismiss: number
): boolean {
  // We used to use the dismissed mechnism. We are going to re-trigger the prompt
  // if the dismiss time is more than N days ago and fallback to the prompt snooze mechanism
  if (!promptData) {
    return false;
  }

  if (promptData.snoozed_ts) {
    return false;
  }

  if (typeof promptData.dismissed_ts !== 'number') {
    return false;
  }

  const now = moment.utc();
  const dismissedOn = moment.unix(promptData.dismissed_ts).utc();
  return now.diff(dismissedOn, 'days') > daysSinceDismiss;
}

export function useChonkPrompt() {
  const user = useUser();
  const organization = useOrganization({allowNull: true});
  const hasChonkUI = organization?.features.includes('chonk-ui');

  const bannerPrompt = usePrompt({
    organization,
    feature: 'chonk_ui_banner',
    daysToSnooze: DAYS_SINCE_DISMISS,
    options: {enabled: hasChonkUI},
  });

  const dotIndicatorPrompt = usePrompt({
    organization,
    feature: 'chonk_ui_dot_indicator',
    daysToSnooze: DAYS_SINCE_DISMISS,
    options: {enabled: hasChonkUI},
  });

  const bannerData = bannerPrompt.data;
  const dotIndicatorData = dotIndicatorPrompt.data;

  const bannerIsPromptDismissed = bannerPrompt.isPromptDismissed;
  const dotIndicatorIsPromptDismissed = dotIndicatorPrompt.isPromptDismissed;

  const showBannerPrompt = bannerPrompt.showPrompt;
  const showDotIndicatorPrompt = dotIndicatorPrompt.showPrompt;

  useEffect(() => {
    if (!hasChonkUI) {
      return;
    }

    if (user?.options?.prefersChonkUI) {
      return;
    }

    if (
      bannerData &&
      bannerIsPromptDismissed &&
      promptWasDismissedWithoutSnoozing(bannerData, DAYS_SINCE_DISMISS)
    ) {
      showBannerPrompt();
    }

    if (
      dotIndicatorData &&
      dotIndicatorIsPromptDismissed &&
      promptWasDismissedWithoutSnoozing(dotIndicatorData, DAYS_SINCE_DISMISS)
    ) {
      showDotIndicatorPrompt();
    }
  }, [
    bannerData,
    dotIndicatorData,
    bannerIsPromptDismissed,
    dotIndicatorIsPromptDismissed,
    showBannerPrompt,
    showDotIndicatorPrompt,
    hasChonkUI,
    user?.options?.prefersChonkUI,
  ]);

  // UsePrompt returns undefined if the prompt is loading or has failed to load
  // so we need to check for that before rendering the component
  if (bannerPrompt.isLoading || dotIndicatorPrompt.isLoading) {
    return {
      showBannerPrompt: false,
      showDotIndicatorPrompt: false,
      snoozeBannerPrompt: noop,
      snoozeDotIndicatorPrompt: noop,
      snooze: noop,
    };
  }

  // User is optional because we useUser hooks reads the value from ConfigStore,
  if (
    (bannerPrompt.isPromptDismissed && dotIndicatorPrompt.isPromptDismissed) ||
    !hasChonkUI ||
    user?.options?.prefersChonkUI
  ) {
    return {
      showBannerPrompt: false,
      showDotIndicatorPrompt: false,
      snoozeBannerPrompt: noop,
      snoozeDotIndicatorPrompt: noop,
      snooze: noop,
    };
  }

  return {
    showBannerPrompt: !bannerPrompt.isPromptDismissed,
    showDotIndicatorPrompt: Boolean(
      bannerPrompt.isPromptDismissed && !dotIndicatorPrompt.isPromptDismissed
    ),
    snoozeBannerPrompt: () => {
      if (bannerPrompt.isPromptDismissed) {
        return;
      }

      bannerPrompt.snoozePrompt();
    },
    snoozeDotIndicatorPrompt: () => {
      if (dotIndicatorPrompt.isPromptDismissed) {
        return;
      }

      dotIndicatorPrompt.snoozePrompt();
    },
    snooze: () => {
      bannerPrompt.snoozePrompt();
      dotIndicatorPrompt.snoozePrompt();
    },
  };
}
