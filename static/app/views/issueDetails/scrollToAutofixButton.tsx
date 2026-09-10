import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {IconArrow} from 'sentry/icons/iconArrow';
import {t} from 'sentry/locale';
import {useScrollToAutofixPrompt} from 'sentry/views/issueDetails/hooks/useScrollToAutofixPrompt';

interface ScrollToAutofixButtonProps {
  groupId: string;
}

/**
 * Floats over the issue content to offer a trip to the autofix section after
 * the reader acts on an autofix embed in the Seer chat.
 *
 * Sticky rather than fixed so the button stays inside the issue column: the
 * Seer chat can hold the right or bottom of the viewport, and a
 * viewport-anchored button would end up underneath it. Zero height keeps it out
 * of the flow, so a page that isn't prompting gains no trailing gap.
 */
export function ScrollToAutofixButton({groupId}: ScrollToAutofixButtonProps) {
  const theme = useTheme();
  const {direction, scrollToAutofix} = useScrollToAutofixPrompt(groupId);

  if (!direction) {
    return null;
  }

  return (
    <Flex
      position="sticky"
      bottom={theme.space['2xl']}
      height="0"
      overflow="visible"
      justify="center"
    >
      <Button
        size="sm"
        variant="primary"
        icon={<IconArrow direction={direction} />}
        onClick={scrollToAutofix}
        analyticsEventKey="issue_details.scroll_to_autofix_clicked"
        analyticsEventName="Issue Details: Scroll To Autofix Clicked"
        analyticsParams={{group_id: groupId, direction}}
      >
        {direction === 'down' ? t('Scroll down to Autofix') : t('Scroll up to Autofix')}
      </Button>
    </Flex>
  );
}
