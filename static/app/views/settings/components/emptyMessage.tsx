import * as React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import TextBlock from 'app/views/settings/components/text/textBlock';

type Props = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactElement;
  size?: 'large' | 'medium';
  leftAligned?: boolean;
};

type EmptyMessageProps = Omit<React.HTMLProps<HTMLDivElement>, keyof Props> & Props;
type WrapperProps = Pick<EmptyMessageProps, 'size'>;

const EmptyMessage = styled(
  ({
    title,
    description,
    icon,
    children,
    action,
    leftAligned: _leftAligned,
    ...props
  }: EmptyMessageProps) => (
    <div data-test-id="empty-message" {...props}>
      {icon && <IconWrapper>{icon}</IconWrapper>}
      {title && <Title noMargin={!description && !children && !action}>{title}</Title>}
      {description && <Description>{description}</Description>}
      {children && <Description noMargin>{children}</Description>}
      {action && <Action>{action}</Action>}
    </div>
  )
)<WrapperProps>`
  display: flex;
  ${p =>
    p.leftAligned
      ? css`
          max-width: 70%;
          align-items: flex-start;
          padding: ${space(4)};
        `
      : css`
          text-align: center;
          align-items: center;
          padding: ${space(4)} 15%;
        `};
  flex-direction: column;
  color: ${p => p.theme.textColor};
  font-size: ${p =>
    p.size && p.size === 'large' ? p.theme.fontSizeExtraLarge : p.theme.fontSizeLarge};
`;

const IconWrapper = styled('div')`
  color: ${p => p.theme.gray200};
  margin-bottom: ${space(1)};
`;

const Title = styled('strong')<{noMargin: boolean}>`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  ${p => !p.noMargin && `margin-bottom: ${space(1)};`}
`;

const Description = styled(TextBlock)`
  margin: 0;
`;

const Action = styled('div')`
  margin-top: ${space(2)};
`;

export default EmptyMessage;
