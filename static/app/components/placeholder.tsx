import * as React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

const defaultProps = {
  shape: 'rect' as 'rect' | 'circle',
  bottomGutter: 0 as Parameters<typeof space>[0],
  width: '100%',
  height: '60px',
  testId: 'loading-placeholder',
};

type DefaultProps = Readonly<typeof defaultProps>;

type Props = {
  className?: string;
  children?: React.ReactNode;
  error?: React.ReactNode;
  testId?: string;
} & Partial<DefaultProps>;

const Placeholder = styled(({className, children, error, testId}: Props) => {
  return (
    <div data-test-id={testId} className={className}>
      {error || children}
    </div>
  );
})<Props>`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;

  background-color: ${p => (p.error ? p.theme.red100 : p.theme.backgroundSecondary)};
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
