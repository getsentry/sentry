import styled from '@emotion/styled';

const getBackgroundColor = p => {
  if (p.color) {
    return `background: ${p.color};`;
  }

  return `background: ${
    p.status === 'error'
      ? p.theme.error
      : p.status === 'ok'
      ? p.theme.success
      : p.theme.disabled
  };`;
};

const getSize = p => `
  height: ${p.size}px;
  width: ${p.size}px;
`;

export default styled('div')`
  display: inline-block;
  position: relative;
  border-radius: 50%;
  ${getSize};
  ${getBackgroundColor};
`;
