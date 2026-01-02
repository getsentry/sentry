import styled from '@emotion/styled';

import EmptyMessage from 'sentry/components/emptyMessage';
import {IconMail} from 'sentry/icons';
import {t} from 'sentry/locale';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

const FeedbackEmptyDetails = styled((props: any) => (
  <FluidHeight {...props}>
    <StyledEmptyMessage icon={<IconMail />}>
      {t('No feedback selected')}
    </StyledEmptyMessage>
  </FluidHeight>
))`
  display: grid;
  place-items: center;
`;

const StyledEmptyMessage = styled(EmptyMessage)`
  font-size: ${p => p.theme.fontSize.xl};
`;

export default FeedbackEmptyDetails;
