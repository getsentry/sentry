import {usePrompt} from 'sentry/actionCreators/prompts';
import useOrganization from 'sentry/utils/useOrganization';

function noop() {}

export function useChonkPrompt() {
  const organization = useOrganization();
  const hasChonkUI = organization?.features.includes('chonk-ui');

  const tooltipPrompt = usePrompt({
    organization,
<<<<<<< HEAD
    feature: 'chonk-ui-tooltip',
=======
    feature: 'chonk_ui_banner',
>>>>>>> 4153a154687 (chonk: add nav prompts)
    options: {enabled: hasChonkUI},
  });

  const dotIndicatorPrompt = usePrompt({
    organization,
<<<<<<< HEAD
    feature: 'chonk-ui-dot-indicator',
=======
    feature: 'chonk_ui_dot_indicator',
>>>>>>> 4153a154687 (chonk: add nav prompts)
    options: {enabled: hasChonkUI},
  });

  if (!hasChonkUI) {
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
