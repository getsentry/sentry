import * as React from 'react';
import styled from '@emotion/styled';

import {IconChevron, IconList} from 'sentry/icons';
import {tct} from 'sentry/locale';
import space from 'sentry/styles/space';

export const COLLAPSE_COUNT = 5;

type ChildRenderProps = {
  isExpanded: boolean;
  showMoreButton: React.ReactNode;
};

type Props = {
  children: (props: ChildRenderProps) => JSX.Element;
  items: number;
  buttonTitle?: string;
  collapseCount?: number;
};

/**
 * Used to expand results.
 *
 * Our collapsible component was not used because we want our
 * expand button to be outside the list of children
 *
 */
function CollapsePanel({
  items,
  children,
  buttonTitle,
  collapseCount = COLLAPSE_COUNT,
}: Props) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  function expandResults() {
    setIsExpanded(true);
  }

  return children({
    isExpanded,
    showMoreButton:
      isExpanded || items <= collapseCount ? null : (
        <ShowMoreButton
          items={items}
          buttonTitle={buttonTitle}
          collapseCount={collapseCount}
          onClick={expandResults}
        />
      ),
  });
}

type ShowMoreButtonProps = {
  items: number;
  onClick: () => void;
  buttonTitle?: string;
  collapseCount?: number;
};

function ShowMoreButton({
  items,
  buttonTitle = 'More',
  collapseCount = COLLAPSE_COUNT,
  onClick,
}: ShowMoreButtonProps) {
  return (
    <ShowMore onClick={onClick} role="button" data-test-id="collapse-show-more">
      <ShowMoreText>
        <StyledIconList color="gray300" />
        {tct('Show [count] [buttonTitle]', {count: items - collapseCount, buttonTitle})}
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
