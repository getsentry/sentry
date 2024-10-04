import styled from '@emotion/styled';

export const Redaction = styled('span')<{withoutBackground?: boolean}>`
  cursor: default;
  ${p => !p.withoutBackground && `background: rgba(255, 0, 0, 0.05);`}
`;
