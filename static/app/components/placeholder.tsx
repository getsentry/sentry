import styled from '@emotion/styled';

import type {SpaceSize} from 'sentry/utils/theme';

export interface PlaceholderProps {
  bottomGutter?: SpaceSize;
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
  border-radius: ${p => p.theme.radius.md};
  background-color: ${p =>
    p.error ? p.theme.colors.red100 : p.theme.tokens.background.tertiary};
  ${p => !!p.error && `color: ${p.theme.colors.red200};`}
  width: ${p => p.width ?? '100%'};
  height: ${p => p.height ?? '60px'};
  ${({shape = 'rect'}) => (shape === 'circle' ? 'border-radius: 100%;' : '')}
  ${({bottomGutter, theme}) =>
    bottomGutter ? `margin-bottom: ${theme.space[bottomGutter]};` : ''}
`;

export default Placeholder;
