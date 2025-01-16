import styled from '@emotion/styled';

import type {ValidSize} from 'sentry/styles/space';
import {space} from 'sentry/styles/space';

export interface PlaceholderProps {
  bottomGutter?: ValidSize;
  children?: React.ReactNode;
  className?: string;
  error?: React.ReactNode;
  height?: string;
  shape?: 'rect' | 'circle';
  style?: React.CSSProperties;
  testId?: string;
  width?: string;
}

const Placeholder = styled(
  ({
    className,
    children,
    error,
    testId = 'loading-placeholder',
    style,
  }: PlaceholderProps) => {
    return (
      <div data-test-id={testId} className={className} style={style}>
        {error || children}
      </div>
    );
  }
)<PlaceholderProps>`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  border-radius: ${p => p.theme.borderRadius};

  background-color: ${p => (p.error ? p.theme.red100 : p.theme.backgroundTertiary)};
  ${p => p.error && `color: ${p.theme.red200};`}
  width: ${p => p.width ?? '100%'};
  height: ${p => p.height ?? '60px'};
  ${({shape = 'rect'}) => (shape === 'circle' ? 'border-radius: 100%;' : '')}
  ${({bottomGutter = 0}) =>
    typeof bottomGutter === 'number' && bottomGutter > 0
      ? `margin-bottom: ${space(bottomGutter as Parameters<typeof space>[0])};`
      : ''}
`;

export default Placeholder;
