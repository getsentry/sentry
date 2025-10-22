import {usePrompt} from 'sentry/actionCreators/prompts';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

function noop() {}

export function useChonkPrompt() {
  const user = useUser();
  const organization = useOrganization({allowNull: true});
  const hasChonkUI = organization?.features.includes('chonk-ui');

  const bannerPrompt = usePrompt({
    organization,
    feature: 'chonk_ui_banner',
    daysToSnooze: 7,
    options: {enabled: hasChonkUI},
  });

  const dotIndicatorPrompt = usePrompt({
    organization,
    feature: 'chonk_ui_dot_indicator',
    daysToSnooze: 7,
    options: {enabled: hasChonkUI},
  });

  // UsePrompt returns undefined if the prompt is loading or has failed to load
  // so we need to check for that before rendering the component
  if (bannerPrompt.isLoading || dotIndicatorPrompt.isLoading) {
    return {
      showbannerPrompt: false,
      showDotIndicatorPrompt: false,
      dismissBannerPrompt: noop,
      dismissDotIndicatorPrompt: noop,
      dismiss: noop,
    };
  }

  // User is optional because we useUser hooks reads the value from ConfigStore,
  if (
    (bannerPrompt.isPromptDismissed && dotIndicatorPrompt.isPromptDismissed) ||
    !hasChonkUI ||
    user?.options?.prefersChonkUI
  ) {
    return {
      showbannerPrompt: false,
      showDotIndicatorPrompt: false,
      dismissBannerPrompt: noop,
      dismissDotIndicatorPrompt: noop,
      dismiss: noop,
    };
  }

  // The dot indicator is only visible after the tooltip is dismissed
  const showDotIndicatorPrompt = Boolean(
    bannerPrompt.isPromptDismissed && !dotIndicatorPrompt.isPromptDismissed
  );

  return {
    showbannerPrompt: !bannerPrompt.isPromptDismissed,
    showDotIndicatorPrompt,
    dismissBannerPrompt: () => {
      if (bannerPrompt.isPromptDismissed) {
        return;
      }

      bannerPrompt.snoozePrompt();
    },
    dismissDotIndicatorPrompt: () => {
      if (dotIndicatorPrompt.isPromptDismissed) {
        return;
      }

      dotIndicatorPrompt.snoozePrompt();
    },
    dismiss: () => {
      bannerPrompt.snoozePrompt();
      dotIndicatorPrompt.snoozePrompt();
    },
  };
}
