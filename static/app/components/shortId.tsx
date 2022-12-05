import styled from '@emotion/styled';

import AutoSelectText from 'sentry/components/autoSelectText';
import Link, {LinkProps} from 'sentry/components/links/link';

interface Props {
  shortId: string;
  avatar?: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /**
   * A router target destination
   */
  to?: LinkProps['to'];
}

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
  gap: 0.5em;
  align-items: center;
  justify-content: flex-end;
`;

export const StyledAutoSelectText = styled(AutoSelectText)`
  min-width: 0;

  a & {
    color: ${p => p.theme.linkColor};
  }
`;

export default ShortId;
