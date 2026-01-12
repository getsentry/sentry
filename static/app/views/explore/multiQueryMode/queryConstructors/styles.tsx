import styled from '@emotion/styled';

import {Flex, type FlexProps} from '@sentry/scraps/layout';

export const Section = styled('div')``;

export function SectionHeader(props: FlexProps<'div'>) {
  return <Flex justify="between" align="baseline" marginBottom="xs" {...props} />;
}

export const SectionLabel = styled('h6')<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.tokens.content.disabled : p.theme.colors.gray800)};
  font-size: ${p => p.theme.form.md.fontSize};
  margin: 0;
  text-decoration: underline dotted
    ${p => (p.disabled ? p.theme.colors.gray400 : p.theme.colors.gray400)};
`;
