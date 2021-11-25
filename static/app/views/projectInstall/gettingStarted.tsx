import * as React from 'react';
import styled from '@emotion/styled';

import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';

type Props = {
  className?: string;
  children: React.ReactNode;
};

function GettingStarted({className, children}: Props) {
  return <PageContent className={className}>{children}</PageContent>;
}
export default styled(GettingStarted)`
  background: ${p => p.theme.background};
  padding-top: ${space(3)};
`;
