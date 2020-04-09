import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import InlineSvg from 'app/components/inlineSvg';
import TextBlock from 'app/views/settings/components/text/textBlock';
import space from 'app/styles/space';

type Props = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: string | React.ReactNode;
  action?: React.ReactElement;
  size?: 'large' | 'medium';
};

type EmptyMessageProps = Omit<React.HTMLProps<HTMLDivElement>, keyof Props> & Props;
type WrapperProps = Pick<EmptyMessageProps, 'size'>;

const EmptyMessage = styled(
  ({title, description, icon, children, action, ...props}: EmptyMessageProps) => (
    <div data-test-id="empty-message" {...props}>
      {icon && (
        <IconWrapper>
          {typeof icon === 'string' ? <InlineSvg src={icon} size="32px" /> : icon}
        </IconWrapper>
      )}
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
  icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  action: PropTypes.element,
  // Currently only the `large` option changes the size - can add more size options as necessary
  size: PropTypes.oneOf(['large', 'medium']),
};

const IconWrapper = styled('div')`
  color: ${p => p.theme.gray1};
  margin-bottom: ${space(1)};
`;

const Title = styled('h1')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1)};
`;

const Description = styled(TextBlock)`
  margin: 0;
`;

const Action = styled('div')`
  margin-top: ${space(2)};
`;

export default EmptyMessage;
