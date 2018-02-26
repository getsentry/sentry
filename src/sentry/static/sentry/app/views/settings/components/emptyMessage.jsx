import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import InlineSvg from '../../../components/inlineSvg';

const Wrapper = styled.div`
  color: ${p => p.theme.gray4};
  text-align: center;
  padding: ${p => p.theme.grid * 3}px;
  font-size: 1.5em;
  font-weight: bold;
`;

const Icon = styled.div`
  display: block;
  margin: 0 auto ${p => p.theme.grid * 2.5}px;
  color: ${p => p.theme.gray1};
`;

const Action = styled.div`
  display: block;
  margin: ${p => p.theme.grid * 2.5}px auto 0;
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
