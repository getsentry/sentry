import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

type Props = {
  /**
   * The text interface
   */
  children: string;
};

const CommandLine = ({children}: Props) => <Wrapper>{children}</Wrapper>;

export default CommandLine;

const Wrapper = styled('code')`
  padding: ${space(0.5)} ${space(1)};
  color: ${p => p.theme.pink300};
  background: ${p => p.theme.pink100};
  border: 1px solid ${p => p.theme.pink200};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeMedium};
  white-space: nowrap;
`;
