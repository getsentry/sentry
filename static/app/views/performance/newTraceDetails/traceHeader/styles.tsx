import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import Placeholder from 'sentry/components/placeholder';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

function FeedbackButton() {
  const openForm = useFeedbackForm();

  return openForm ? (
    <Button
      size="xs" redesign
      aria-label="trace-view-feedback"
      icon={<IconMegaphone size="xs" redesign />}
      onClick={() =>
        openForm({
          messagePlaceholder: t('How can we make the trace view better for you?'),
          tags: {
            ['feedback.source']: 'trace-view',
            ['feedback.owner']: 'performance',
          },
        })
      }
    >
      {t('Give Feedback')}
    </Button>
  ) : null;
}

const HeaderLayout = styled('div')`
  background-color: ${p => p.theme.background};
  padding: ${space(1)} ${space(3)} ${space(1)} ${space(3)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const HeaderRow = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(2)};
  align-items: center;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    gap: ${space(1)};
    flex-direction: column;
  }
`;

const HeaderContent = styled('div')`
  display: flex;
  flex-direction: column;
`;

const StyledBreak = styled('hr')`
  margin: ${space(1)} 0;
  border-color: ${p => p.theme.border};
`;

const StyledPlaceholder = styled(Placeholder)<{_height: number; _width: number}>`
  border-radius: ${p => p.theme.borderRadius};
  height: ${p => p._height}px;
  width: ${p => p._width}px;
`;

const TraceHeaderComponents = {
  HeaderLayout,
  HeaderRow,
  HeaderContent,
  StyledBreak,
  FeedbackButton,
  StyledPlaceholder,
};

export {TraceHeaderComponents};
