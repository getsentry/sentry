import React from 'react';
import styled from 'react-emotion';

import ErrorLevel from 'app/components/events/errorLevel';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {PropTypes} from 'mobx-react';

const Message = styled('span')`
  ${overflowEllipsis}
  width: auto;
  max-height: 38px;
`;

function EventMessage({className, level, message, annotations}) {
  return (
    <div className={className}>
      <ErrorLevel level={level}>{level}</ErrorLevel>
      {message && <Message>{message}</Message>}
      {annotations}
    </div>
  );
}

EventMessage.propTypes = {
  level: PropTypes.oneOf(['error', 'fatal', 'info', 'warning', 'sample']),
  message: PropTypes.node,
  annotations: PropTypes.node,
};

export default styled(EventMessage)`
  display: flex;
  align-items: center;
  position: relative;
  line-height: 1.2;
`;
