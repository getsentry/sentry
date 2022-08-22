import styled from '@emotion/styled';

type Props = {
  size: number | string;
  status: 'error' | 'ok';
  color?: string;
};

export default styled('div')<Props>`
  display: inline-block;
  position: relative;
  border-radius: 50%;
  height: ${p => p.size}px;
  width: ${p => p.size}px;

  ${p =>
    p.color
      ? `background: ${p.color};`
      : `background: ${
          p.status === 'error'
            ? p.theme.error
            : p.status === 'ok'
            ? p.theme.success
            : p.theme.disabled
        };`};
`;
