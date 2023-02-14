import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

interface Props extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  action?: React.ReactElement;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  leftAligned?: boolean;
  size?: 'large' | 'medium';
  title?: React.ReactNode;
}

type WrapperProps = Pick<Props, 'size'>;

const EmptyMessage = styled(
  ({
    title,
    description,
    icon,
    children,
    action,
    leftAligned: _leftAligned,
    ...props
  }: Props) => (
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
    p.size && p.size === 'large' ? p.theme.fontSizeExtraLarge : p.theme.fontSizeMedium};
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
