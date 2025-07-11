import styled from '@emotion/styled';
import type {LocationDescriptorObject} from 'history';

import type {Directions} from 'sentry/components/tables/gridEditable/sortLink';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import {IconArrow} from 'sentry/icons';
import type {Alignments} from 'sentry/utils/discover/fields';

type ColumnHeaderProps = {
  align: Alignments;
  canSort: boolean;
  direction: Directions;
  generateSortLink: () => LocationDescriptorObject | undefined;
  title: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
};

export function ColumnHeader({
  align,
  title,
  canSort,
  generateSortLink,
  onClick,
  direction,
}: ColumnHeaderProps) {
  if (!canSort || !onClick) {
    return (
      <SortLink
        title={title}
        align={align}
        generateSortLink={generateSortLink}
        direction={direction}
        canSort={canSort}
      />
    );
  }

  const arrow = direction ? (
    <StyledIconArrow size="xs" direction={direction === 'desc' ? 'down' : 'up'} />
  ) : null;

  return (
    <StyledSortButton onClick={onClick} align={align}>
      {title} {arrow}
    </StyledSortButton>
  );
}

const StyledSortButton = styled('div')<{align: Alignments}>`
  display: block;
  width: 100%;
  white-space: nowrap;
  :hover {
    cursor: pointer;
  }
  ${(p: {align: Alignments}) => (p.align ? `text-align: ${p.align};` : '')}
`;

const StyledIconArrow = styled(IconArrow)`
  vertical-align: top;
`;
