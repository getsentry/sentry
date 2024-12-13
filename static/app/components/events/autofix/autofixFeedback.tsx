import {useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconMegaphone} from 'sentry/icons/iconMegaphone';
import {t} from 'sentry/locale';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

function AutofixFeedback() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openForm = useFeedbackForm();

  if (!openForm) {
    return null;
  }

  return (
    <StyledButton
      ref={buttonRef}
      size="zero"
      borderless
      icon={<IconMegaphone />}
      onClick={() =>
        openForm({
          messagePlaceholder: t('How can we make Autofix better for you?'),
          tags: {
            ['feedback.source']: 'issue_details_ai_autofix',
            ['feedback.owner']: 'ml-ai',
          },
        })
      }
    >
      {t('Give Feedback')}
    </StyledButton>
  );
}

const StyledButton = styled(Button)`
  padding: 0;
  margin: 0;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.subText};
`;

export default AutofixFeedback;
