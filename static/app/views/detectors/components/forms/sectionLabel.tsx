import styled from '@emotion/styled';

export const SectionLabel = styled('span')<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.tokens.content.disabled : p.theme.colors.gray800)};
  font-size: ${p => p.theme.form.md.fontSize};
  font-weight: 600;
  margin: 0;
`;

export const SectionLabelSecondary = styled(SectionLabel)`
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: normal;
`;
