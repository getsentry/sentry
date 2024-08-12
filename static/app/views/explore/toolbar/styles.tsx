import styled from '@emotion/styled';

export const ToolbarSection = styled('div')``;

export const ToolbarHeading = styled('h6')<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.gray300 : p.theme.purple300)};
  height: ${p => p.theme.form.md.height};
  min-height: ${p => p.theme.form.md.minHeight};
  font-size: ${p => p.theme.form.md.fontSize};
  line-height: ${p => p.theme.form.md.lineHeight};
  text-decoration: underline dotted
    ${p => (p.disabled ? p.theme.gray300 : p.theme.purple300)};
`;
