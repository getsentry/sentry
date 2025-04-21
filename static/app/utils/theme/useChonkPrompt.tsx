import {usePrompt} from 'sentry/actionCreators/prompts';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

function noop() {}

export function useChonkPrompt() {
  const user = useUser();
  const organization = useOrganization();
  const hasChonkUI = organization?.features.includes('chonk-ui');

  const tooltipPrompt = usePrompt({
    organization,
    feature: 'chonk-ui-tooltip',
    options: {enabled: hasChonkUI},
  });

  const dotIndicatorPrompt = usePrompt({
    organization,
    feature: 'chonk-ui-dot-indicator',
    options: {enabled: hasChonkUI},
  });

  // User is optional because we useUser hooks reads the value from ConfigStore,
  // and I have little trust in its type safety.
  if (!hasChonkUI || user?.options?.prefersChonkUI) {
    return {
      showTooltipPrompt: false,
      showDotIndicatorPrompt: false,
      dismissTooltipPrompt: noop,
      dismissDotIndicatorPrompt: noop,
    };
  }

  return {
    showTooltipPrompt: !tooltipPrompt.isPromptDismissed,
    // The dot indicator is visible after the tooltip is dismissed
    showDotIndicatorPrompt: Boolean(
      tooltipPrompt.isPromptDismissed && !dotIndicatorPrompt.isPromptDismissed
    ),
    dismissTooltipPrompt: tooltipPrompt.dismissPrompt,
    dismissDotIndicatorPrompt: dotIndicatorPrompt.dismissPrompt,
  };
}
