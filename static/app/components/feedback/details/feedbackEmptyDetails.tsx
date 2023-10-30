import styled from '@emotion/styled';

import EmptyMessage from 'sentry/components/emptyMessage';
import {IconMail} from 'sentry/icons';
import {t} from 'sentry/locale';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

const FeedbackEmptyDetails = styled(props => (
  <FluidHeight {...props}>
    <EmptyMessage icon={<IconMail />} description={t('No feedback selected')} />
  </FluidHeight>
))`
  display: grid;
  place-items: center;
`;

export default FeedbackEmptyDetails;
