import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

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
  font-size: ${p =>
    p.size && p.size.large ? p.theme.fontSizeExtraLarge : p.theme.fontSizeLarge};
`;

const MarginStyles = css`
  margin-bottom: ${space(2)};
  &:last-child {
    margin: 0;
  }
`;

const Description = styled(TextBlock)`
  ${MarginStyles};
`;

const Title = styled.div`
  font-weight: bold;
  font-size: 20px;
  line-height: 1.2;
  ${MarginStyles};

  & + ${Description} {
    margin-top: -${space(0.5)}; /* Remove the illusion of bad padding by offsetting line-height */
  }
`;

const StyledInlineSvg = styled(InlineSvg)`
  display: block;
  color: ${p => p.theme.gray1};
  ${MarginStyles};
`;

const Action = styled.div`
  display: block;
  ${MarginStyles};
`;

const EmptyMessage = ({title, description, icon, children, action, size}) => {
  return (
    <Wrapper size={size}>
      {icon && <StyledInlineSvg src={icon} size="36px" />}
      {title && <Title>{title}</Title>}
      {description && <Description>{description}</Description>}
      {children && <Description noMargin>{children}</Description>}
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
