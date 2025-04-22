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
    options: {enabled: hasChonkUI},
  });

  const dotIndicatorPrompt = usePrompt({
    organization,
    feature: 'chonk_ui_dot_indicator',
    options: {enabled: hasChonkUI},
  });

  // User is optional because we useUser hooks reads the value from ConfigStore,
  // and I have little trust in its type safety.
  if (!hasChonkUI || user?.options?.prefersChonkUI) {
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

      bannerPrompt.dismissPrompt();
    },
    dismissDotIndicatorPrompt: () => {
      if (!showDotIndicatorPrompt) {
        return;
      }

      dotIndicatorPrompt.dismissPrompt();
    },
    dismiss: () => {
      bannerPrompt.dismissPrompt();
      dotIndicatorPrompt.dismissPrompt();
    },
  };
}
