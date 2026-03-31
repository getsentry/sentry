import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {IconChevron, IconList} from 'sentry/icons';
import {tct} from 'sentry/locale';

export const COLLAPSE_COUNT = 5;

type ChildRenderProps = {
  isExpanded: boolean;
  showMoreButton: React.ReactNode;
};

type Props = {
  children: (props: ChildRenderProps) => React.JSX.Element;
  items: number;
  buttonTitle?: string;
  collapseCount?: number;
  disableBorder?: boolean;
};

/**
 *
 * Used to expand results.
 *
 * Our collapsible component was not used because we want our
 * expand button to be outside the list of children
 *
 */
export function CollapsePanel({
  items,
  children,
  buttonTitle,
  collapseCount = COLLAPSE_COUNT,
  disableBorder = true,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
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
          disableBorder={disableBorder}
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
  disableBorder?: boolean;
};

function ShowMoreButton({
  items,
  buttonTitle = 'More',
  collapseCount = COLLAPSE_COUNT,
  disableBorder = true,
  onClick,
}: ShowMoreButtonProps) {
  return (
    <ShowMore
      onClick={onClick}
      role="button"
      data-test-id="collapse-show-more"
      disableBorder={disableBorder}
    >
      <Flex align="center" flexGrow={1}>
        <StyledIconList variant="muted" />
        {tct('Show [count] [buttonTitle]', {count: items - collapseCount, buttonTitle})}
      </Flex>

      <IconChevron variant="muted" direction="down" />
    </ShowMore>
  );
}

const ShowMore = styled('div')<{disableBorder: boolean}>`
  display: flex;
  align-items: center;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.tokens.content.secondary};
  cursor: pointer;
  border-top: 1px solid ${p => p.theme.tokens.border.primary};

  ${p =>
    !p.disableBorder &&
    css`
      border-left: 1px solid ${p.theme.tokens.border.primary};
      border-right: 1px solid ${p.theme.tokens.border.primary};
      border-bottom: 1px solid ${p.theme.tokens.border.primary};
      border-bottom-left-radius: ${p.theme.radius.md};
      border-bottom-right-radius: ${p.theme.radius.md};
      margin-bottom: ${p.theme.space.xl};
    `}
`;

const StyledIconList = styled(IconList)`
  margin-right: ${p => p.theme.space.md};
`;
