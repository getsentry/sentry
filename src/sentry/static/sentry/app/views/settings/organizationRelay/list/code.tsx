import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

type Props = {
  children: string;
};

// TODO(Priscila): Make this component reusable and available in the storybook
const Code = ({children}: Props) => <Wrapper>{children}</Wrapper>;

export default Code;

const Wrapper = styled('code')`
  padding: ${space(0.5)} ${space(1)};
  color: ${p => p.theme.pink400};
  background: ${p => p.theme.pink100};
  border: 1px solid ${p => p.theme.pink200};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeMedium};
`;
