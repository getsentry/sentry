import styled from '@emotion/styled';
import first from 'lodash/first';
import last from 'lodash/last';

import {Hovercard} from 'sentry/components/hovercard';
import TextOverflow from 'sentry/components/textOverflow';
import Tooltip from 'sentry/components/tooltip';
import {tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {BreadcrumbTypeNavigation, Crumb} from 'sentry/types/breadcrumbs';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import BreadcrumbItem from 'sentry/views/replays/detail/breadcrumbs/breadcrumbItem';

type MaybeOnClickHandler = null | ((crumb: Crumb) => void);

function splitCrumbs({
  crumbs,
  onClick,
  startTimestampMs,
}: {
  crumbs: BreadcrumbTypeNavigation[];
  onClick: MaybeOnClickHandler;
  startTimestampMs: number;
}) {
  const firstUrl = first(crumbs)?.data?.to?.split('?')?.[0];
  const summarizedCrumbs = crumbs.slice(1, -1) as Crumb[];
  const lastUrl = last(crumbs)?.data?.to?.split('?')?.[0];

  if (crumbs.length === 0) {
    // This one shouldn't overflow, but by including the component css stays
    // consistent with the other Segment types
    return [
      <Span key="summary">
        <TextOverflow>{tn('%s Page', '%s Pages', 0)}</TextOverflow>
      </Span>,
    ];
  }

  if (crumbs.length > 3) {
    return [
      <SingleLinkSegment
        key="first"
        path={firstUrl}
        onClick={onClick ? () => onClick(first(crumbs) as Crumb) : null}
      />,
      <SummarySegment
        key="summary"
        crumbs={summarizedCrumbs}
        startTimestampMs={startTimestampMs}
        handleOnClick={onClick}
      />,
      <SingleLinkSegment
        key="last"
        path={lastUrl}
        onClick={onClick ? () => onClick(last(crumbs) as Crumb) : null}
      />,
    ];
  }

  return crumbs.map((crumb, i) => (
    <SingleLinkSegment
      key={i}
      path={firstUrl}
      onClick={onClick ? () => onClick(crumb as Crumb) : null}
    />
  ));
}

function SingleLinkSegment({
  onClick,
  path,
}: {
  onClick: null | (() => void);
  path: undefined | string;
}) {
  if (!path) {
    return null;
  }
  const content = (
    <Tooltip title={path}>
      <TextOverflow ellipsisDirection="left">{path}</TextOverflow>
    </Tooltip>
  );
  if (onClick) {
    return (
      <Link href="#" onClick={onClick}>
        {content}
      </Link>
    );
  }
  return <Span>{content}</Span>;
}

function SummarySegment({
  crumbs,
  handleOnClick,
  startTimestampMs,
}: {
  crumbs: Crumb[];
  handleOnClick: MaybeOnClickHandler;
  startTimestampMs: number;
}) {
  const {handleMouseEnter, handleMouseLeave} = useCrumbHandlers(startTimestampMs);

  const summaryItems = (
    <ScrollingList>
      {crumbs.map((crumb, i) => (
        <li key={crumb.id || i}>
          <BreadcrumbItem
            crumb={crumb}
            startTimestampMs={startTimestampMs}
            isHovered={false}
            isSelected={false}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleOnClick}
          />
        </li>
      ))}
    </ScrollingList>
  );

  return (
    <Span>
      <HalfPaddingHovercard body={summaryItems} position="right">
        <TextOverflow>{tn('%s Page', '%s Pages', crumbs.length)}</TextOverflow>
      </HalfPaddingHovercard>
    </Span>
  );
}

const ScrollingList = styled('ul')`
  padding: 0;
  margin: 0;
  list-style: none;
  max-height: calc(100vh - 32px);
  overflow: scroll;
`;

const Span = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 0;
  max-width: 240px;
`;

const Link = styled('a')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 0;
  text-decoration: underline;
`;

const HalfPaddingHovercard = styled(
  ({children, bodyClassName, ...props}: React.ComponentProps<typeof Hovercard>) => (
    <Hovercard bodyClassName={bodyClassName || '' + ' half-padding'} {...props}>
      {children}
    </Hovercard>
  )
)`
  .half-padding {
    padding: ${space(0.5)};
  }
`;

export default splitCrumbs;
