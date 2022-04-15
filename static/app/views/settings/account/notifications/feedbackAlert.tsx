import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {tct} from 'sentry/locale';

type Props = {
  className?: string;
};

const FeedbackAlert = ({className}: Props) => (
  <StyledAlert type="info" showIcon className={className}>
    {tct('Got feedback? Email [email:ecosystem-feedback@sentry.io].', {
      email: <a href="mailto:ecosystem-feedback@sentry.io" />,
    })}
  </StyledAlert>
);

const StyledAlert = styled(Alert)`
  margin: 20px 0px;
`;

export default FeedbackAlert;
