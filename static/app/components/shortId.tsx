import * as React from 'react';
import styled from '@emotion/styled';

import AutoSelectText from 'app/components/autoSelectText';
import Link from 'app/components/links/link';

type Props = {
  shortId: string;
  avatar?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /**
   * A router target destination
   */
  to?: React.ComponentProps<typeof Link>['to'];
  className?: string;
};

function ShortId({shortId, avatar, onClick, to, className}: Props) {
  if (!shortId) {
    return null;
  }

  return (
    <StyledShortId onClick={onClick} className={className}>
      {avatar}
      {to ? (
        <Link to={to}>{shortId}</Link>
      ) : (
        <StyledAutoSelectText>{shortId}</StyledAutoSelectText>
      )}
    </StyledShortId>
  );
}

const StyledShortId = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  display: grid;
  grid-auto-flow: column;
  grid-gap: 0.5em;
  align-items: center;
  justify-content: flex-end;
`;

const StyledAutoSelectText = styled(AutoSelectText)`
  min-width: 0;
`;

export default ShortId;
