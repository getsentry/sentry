import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';
import TextBlock from 'app/views/settings/components/text/textBlock';
import space from 'app/styles/space';

const Wrapper = styled.div`
  display: flex;
  text-align: center;
  align-items: center;
  flex-direction: column;
  color: ${p => p.theme.gray4};
  padding: ${p => p.theme.grid * 3}px;
  font-size: ${p => (p.theme.large ? p.theme.fontSizeExtraLarge : p.theme.fontSizeLarge)};
  font-weight: bold;
`;

const StyledInlineSvg = styled(InlineSvg)`
  display: block;
  color: ${p => p.theme.gray1};
  width: 2em;
  height: 2em;
  margin-bottom: 0.75em;
`;

const Action = styled.div`
  display: block;
  margin-top: ${space(2)};
`;

const EmptyHeader = styled.div`
  margin-bottom: ${space(2)};
`;

const EmptyDescription = styled(TextBlock)`
  font-size: 0.9em;
  font-weight: normal;
`;

const EmptyMessage = ({title, description, icon, children, action, size}) => {
  return (
    <Wrapper size={size}>
      {icon && <StyledInlineSvg src={icon} />}
      <div className="ref-message">
        {title && <EmptyHeader>{title}</EmptyHeader>}
        {description && <EmptyDescription noMargin>{description}</EmptyDescription>}
        {children}
      </div>
      {action && <Action>{action}</Action>}
    </Wrapper>
  );
};

EmptyMessage.propTypes = {
  title: PropTypes.node,
  description: PropTypes.node,
  icon: PropTypes.string,
  action: PropTypes.element,
  size: PropTypes.oneOf(['large', 'medium']),
};

export default EmptyMessage;
