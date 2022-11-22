import {css} from '@emotion/react';
import styled from '@emotion/styled';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  highlighted?: boolean;
}

function scrollIntoView(element: HTMLDivElement) {
  element?.scrollIntoView?.({block: 'nearest'});
}

const SearchResultWrapper = styled(({highlighted, ...props}: Props) => (
  <div {...props} ref={highlighted ? scrollIntoView : undefined} />
))`
  cursor: pointer;
  display: block;
  color: ${p => p.theme.textColor};
  padding: 10px;
  scroll-margin: 120px;

  ${p =>
    p.highlighted &&
    css`
      color: ${p.theme.activeText};
      background: ${p.theme.backgroundSecondary};
    `};

  &:not(:first-child) {
    border-top: 1px solid ${p => p.theme.innerBorder};
  }
`;

export default SearchResultWrapper;
