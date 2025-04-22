import {usePrompt} from 'sentry/actionCreators/prompts';
import useOrganization from 'sentry/utils/useOrganization';

function noop() {}

export function useChonkPrompt() {
  const organization = useOrganization();
  const hasChonkUI = organization?.features.includes('chonk-ui');

  const tooltipPrompt = usePrompt({
    organization,
    feature: 'chonk_ui_banner',
    options: {enabled: hasChonkUI},
  });

  const dotIndicatorPrompt = usePrompt({
    organization,
    feature: 'chonk_ui_dot_indicator',
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
