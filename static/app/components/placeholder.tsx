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

const defaultProps = {
  shape: 'rect',
  bottomGutter: 0 as Parameters<typeof space>[0],
  width: '100%',
  height: '60px',
  testId: 'loading-placeholder',
} satisfies Partial<PlaceholderProps>;

const Placeholder = styled(
  ({className, children, error, testId, style}: PlaceholderProps) => {
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
  width: ${p => p.width};
  height: ${p => p.height};
  ${p => (p.shape === 'circle' ? 'border-radius: 100%;' : '')}
  ${p =>
    typeof p.bottomGutter === 'number' && p.bottomGutter > 0
      ? `margin-bottom: ${space(p.bottomGutter)};`
      : ''}
`;

Placeholder.defaultProps = defaultProps;

export default Placeholder;
