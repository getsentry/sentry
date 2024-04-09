import styled from '@emotion/styled';

import EmptyMessage from 'sentry/components/emptyMessage';
import {IconMail} from 'sentry/icons';
import {t} from 'sentry/locale';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

const FeedbackEmptyDetails = styled(props => (
  <FluidHeight {...props}>
    <StyledEmptyMessage
      icon={<IconMail size="xl" />}
      description={t('No feedback selected')}
    />
  </FluidHeight>
))`
  display: grid;
  place-items: center;
`;

const StyledEmptyMessage = styled(EmptyMessage)`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

export default FeedbackEmptyDetails;
