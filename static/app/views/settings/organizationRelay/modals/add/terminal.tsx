import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

type Props = {
  command: string;
};

function Terminal({command}: Props) {
  return (
    <Wrapper>
      <Prompt>{'\u0024'}</Prompt>
      {command}
    </Wrapper>
  );
}

export default Terminal;

const Wrapper = styled('div')`
  background: ${p => p.theme.gray500};
  padding: ${space(1.5)} ${space(3)};
  font-family: ${p => p.theme.text.familyMono};
  color: ${p => p.theme.white};
  border-radius: ${p => p.theme.borderRadius};
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(0.75)};
`;

const Prompt = styled('div')`
  color: ${p => p.theme.gray300};
`;
