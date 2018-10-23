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
  padding: ${p => p.theme.grid * 4}px 15%;
  line-height: 1;
  font-size: ${p =>
    p.size && p.size.large ? p.theme.fontSizeExtraLarge : p.theme.fontSizeLarge};
`;

const StyledInlineSvg = styled(InlineSvg)`
  display: block;
  color: ${p => p.theme.gray1};
  margin-bottom: ${space(2)};
`;

const Action = styled.div`
  display: block;
`;

const Title = styled.div`
  font-weight: bold;
  font-size: 20px;
  margin-bottom: ${space(2)};
  line-height: 1.2;
`;

const Description = styled(TextBlock)`
  margin-top: -${space(0.5)}; /* Remove the illusion of bad padding by offsetting line-height */
  margin-bottom: ${space(2)};
`;

const EmptyMessage = ({title, description, icon, children, action, size}) => {
  return (
    <Wrapper size={size}>
      {icon && <StyledInlineSvg src={icon} size="36px" />}
      <div className="ref-message">
        {title && <Title>{title}</Title>}
        {description && <Description noMargin>{description}</Description>}
        {children && <Description noMargin>{children}</Description>}
        {action && <Action>{action}</Action>}
      </div>
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
