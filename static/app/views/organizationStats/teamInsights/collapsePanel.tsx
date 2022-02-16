import * as React from 'react';
import styled from '@emotion/styled';

import {IconChevron, IconList} from 'sentry/icons';
import {tct} from 'sentry/locale';
import space from 'sentry/styles/space';

/** The number of elements to display before collapsing */
export const COLLAPSE_COUNT = 5;

type ChildRenderProps = {
  isExpanded: boolean;
  showMoreButton: React.ReactNode;
};

type Props = {
  children: (props: ChildRenderProps) => JSX.Element;
  items: number;
};

/**
 * Used to expand results for team insights.
 *
 * Our collapsible component was not used because we want our
 * expand button to be outside the list of children
 *
 * This component is not yet generic to use elsewhere. Like the hardcoded COLLAPSE_COUNT
 */
function CollapsePanel({items, children}: Props) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  function expandResults() {
    setIsExpanded(true);
  }

  return children({
    isExpanded,
    showMoreButton:
      isExpanded || items <= COLLAPSE_COUNT ? null : (
        <ShowMoreButton items={items} onClick={expandResults} />
      ),
  });
}

type ShowMoreButtonProps = {
  items: number;
  onClick: () => void;
};

function ShowMoreButton({items, onClick}: ShowMoreButtonProps) {
  return (
    <ShowMore onClick={onClick} role="button" data-test-id="collapse-show-more">
      <ShowMoreText>
        <StyledIconList color="gray300" />
        {tct('Show [count] More', {count: items - COLLAPSE_COUNT})}
      </ShowMoreText>

      <IconChevron color="gray300" direction="down" />
    </ShowMore>
  );
}

export default CollapsePanel;

const ShowMore = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  cursor: pointer;
  border-top: 1px solid ${p => p.theme.border};
`;

const StyledIconList = styled(IconList)`
  margin-right: ${space(1)};
`;

const ShowMoreText = styled('div')`
  display: flex;
  align-items: center;
  flex-grow: 1;
`;
