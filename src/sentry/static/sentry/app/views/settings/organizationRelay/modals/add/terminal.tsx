import styled from '@emotion/styled';

import space from 'app/styles/space';

type Props = {
  command: string;
};

const Terminal = ({command}: Props) => (
  <Wrapper>
    <Prompt>{'\u0024'}</Prompt>
    {command}
  </Wrapper>
);

export default Terminal;

const Wrapper = styled('div')`
  background: ${p => p.theme.gray800};
  padding: ${space(1.5)} ${space(3)};
  font-family: ${p => p.theme.text.familyMono};
  color: ${p => p.theme.white};
  border-radius: ${p => p.theme.borderRadius};
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(0.75)};
`;

const Prompt = styled('div')`
  color: ${p => p.theme.gray500};
`;
