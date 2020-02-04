import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import TextBlock from 'app/views/settings/components/text/textBlock';
import space from 'app/styles/space';

const MarginStyles = `
  margin-bottom: ${space(2)};
  &:last-child {
    margin: 0;
  }
`;

const Description = styled(TextBlock)`
  ${MarginStyles};
`;

const Title = styled('div')`
  font-weight: bold;
  font-size: 20px;
  line-height: 1.2;
  ${MarginStyles};

  & + ${Description} {
    margin-top: -${space(0.5)}; /* Remove the illusion of bad padding by offsetting line-height */
  }
`;

const IconWrapper = styled('div')`
  display: flex;
  ${MarginStyles};
`;

const Action = styled('div')`
  ${MarginStyles};
`;

type Props = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: string | object;
  action?: React.ReactElement;
  size?: 'large' | 'medium';
};

type EmptyMessageProps = Omit<React.HTMLProps<HTMLDivElement>, keyof Props> & Props;
type WrapperProps = Pick<EmptyMessageProps, 'size'>;

const EmptyMessage = styled(
  ({title, description, icon, children, action, ...props}: EmptyMessageProps) => (
    <div data-test-id="empty-message" {...props}>
      {icon && <IconWrapper>{icon}</IconWrapper>}
      {title && <Title>{title}</Title>}
      {description && <Description>{description}</Description>}
      {children && <Description noMargin>{children}</Description>}
      {action && <Action>{action}</Action>}
    </div>
  )
)<WrapperProps>`
  display: flex;
  text-align: center;
  align-items: center;
  flex-direction: column;
  color: ${p => p.theme.gray4};
  padding: ${p => p.theme.grid * 4}px 15%;
  font-size: ${p =>
    p.size && p.size === 'large' ? p.theme.fontSizeExtraLarge : p.theme.fontSizeLarge};
`;

EmptyMessage.propTypes = {
  title: PropTypes.node,
  description: PropTypes.node,
  icon: PropTypes.object,
  action: PropTypes.element,
  // Currently only the `large` option changes the size - can add more size options as necessary
  size: PropTypes.oneOf(['large', 'medium']),
};

export default EmptyMessage;
