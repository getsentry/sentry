import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import InlineSvg from '../../../components/inlineSvg';

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  color: ${p => p.theme.gray4};
  padding: ${p => p.theme.grid * 3}px;
  font-size: 1.5em;
  font-weight: bold;
`;

const Icon = styled.div`
  display: block;
  margin-bottom: ${p => p.theme.grid * 2.5}px;
  color: ${p => p.theme.gray1};
`;

const Action = styled.div`
  display: block;
  margin-top: ${p => p.theme.grid * 2.5}px;
`;

const EmptyMessage = ({icon, children, action}) => {
  return (
    <Wrapper>
      {icon && (
        <Icon>
          <InlineSvg src={icon} size="48px" />
        </Icon>
      )}
      <div className="ref-message">{children}</div>
      {action && <Action>{action}</Action>}
    </Wrapper>
  );
};

EmptyMessage.propTypes = {
  icon: PropTypes.string,
  action: PropTypes.element,
};

export default EmptyMessage;
