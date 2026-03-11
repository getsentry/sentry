import styled from '@emotion/styled';

type Props = {
  /**
   * The text interface
   */
  children: string;
};

function CommandLine({children}: Props) {
  return <Wrapper>{children}</Wrapper>;
}

export default CommandLine;

const Wrapper = styled('code')`
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  color: ${p => p.theme.colors.pink500};
  background: ${p => p.theme.colors.pink100};
  border: 1px solid ${p => p.theme.colors.pink200};
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.md};
  white-space: nowrap;
`;
