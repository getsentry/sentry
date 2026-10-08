import styled from '@emotion/styled';
import {IconMail} from '@sentry/icons/iconMail';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {t} from 'sentry/locale';
import {FluidHeight} from 'sentry/views/explore/replays/detail/layout/fluidHeight';

export const FeedbackEmptyDetails = styled((props: any) => (
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
  font-size: ${p => p.theme.font.size.xl};
`;
