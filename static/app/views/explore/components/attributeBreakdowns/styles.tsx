import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button/button';

import {IconMegaphone} from 'sentry/icons/iconMegaphone';
import {t} from 'sentry/locale';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

function FeedbackButton() {
  const openForm = useFeedbackForm();

  if (!openForm) {
    return null;
  }

  return (
    <StyledFeedbackButton
      size="xs"
      aria-label="attribute-breakdowns-feedback"
      icon={<IconMegaphone size="xs" />}
      onClick={() =>
        openForm?.({
          messagePlaceholder: t(
            'How can we make attribute breakdowns work better for you?'
          ),
          tags: {
            ['feedback.source']: 'attribute-breakdowns',
            ['feedback.owner']: 'ml-ai',
          },
        })
      }
    >
      {t('Feedback')}
    </StyledFeedbackButton>
  );
}

const StyledFeedbackButton = styled(Button)`
  height: 31px !important;
`;

export const AttributeBreakdownsComponent = {
  FeedbackButton,
};
