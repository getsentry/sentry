import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {Level} from 'app/types';
import ErrorLevel from 'app/components/events/errorLevel';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

type Props = {
  level?: Level;
  levelIndicatorSize?: string;
  message?: React.ReactNode;
  annotations?: React.ReactNode;
  className?: string;
};

const EventMessage = ({
  className,
  level,
  levelIndicatorSize,
  message,
  annotations,
}: Props) => {
  return (
    <div className={className}>
      {level && (
        <StyledErrorLevel size={levelIndicatorSize} level={level}>
          {level}
        </StyledErrorLevel>
      )}
      {message && <Message>{message}</Message>}
      {annotations}
    </div>
  );
};

EventMessage.propTypes = {
  level: PropTypes.oneOf(['error', 'fatal', 'info', 'warning', 'sample']),
  levelIndicatorSize: PropTypes.string,
  message: PropTypes.node,
  annotations: PropTypes.node,
  className: PropTypes.string,
};

const StyledEventMessage = styled(EventMessage)`
  display: flex;
  align-items: center;
  position: relative;
  line-height: 1.2;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    margin-bottom: ${space(2)};
  }
`;

const StyledErrorLevel = styled(ErrorLevel)`
  margin-right: ${space(1)};
`;

const Message = styled('span')`
  ${overflowEllipsis}
  width: auto;
  max-height: 38px;
`;

export default StyledEventMessage;
