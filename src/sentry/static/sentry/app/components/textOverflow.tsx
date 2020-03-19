import styled from '@emotion/styled';

const overflow = `
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

const TextOverflow = styled('div')`
  ${overflow}
`;

const ParagraphOverflow = styled('p')`
  ${overflow}
`;

export {TextOverflow, ParagraphOverflow};
export default TextOverflow;
