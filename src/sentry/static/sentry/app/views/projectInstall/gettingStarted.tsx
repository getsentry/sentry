import React from 'react';
import styled from '@emotion/styled';

import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';

type Props = {
  className?: string;
  children: React.ReactNode;
};

function GettingStarted({className, children}: Props) {
  return <PageContent className={className}>{children}</PageContent>;
}
export default styled(GettingStarted)`
  background: ${p => p.theme.white};
  padding-top: ${space(3)};
`;
