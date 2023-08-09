import styled from '@emotion/styled';

import ErrorLevel from 'sentry/components/events/errorLevel';
import {space} from 'sentry/styles/space';
import {Level} from 'sentry/types';

type Props = {
  annotations?: React.ReactNode;
  className?: string;
  hasGuideAnchor?: boolean;
  level?: Level;
  levelIndicatorSize?: string;
  message?: React.ReactNode;
};

const EventMessage = styled(
  ({className, level, levelIndicatorSize, message, annotations}: Props) => (
    <div className={className}>
      {level && <ErrorLevel size={levelIndicatorSize} level={level} />}
      {message && <Message>{message}</Message>}

      {annotations}
    </div>
  )
)`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  position: relative;
  line-height: 1.2;
  overflow: hidden;
`;

const Message = styled('span')`
  ${p => p.theme.overflowEllipsis}
  width: auto;
  max-height: 38px;
`;

export default EventMessage;
