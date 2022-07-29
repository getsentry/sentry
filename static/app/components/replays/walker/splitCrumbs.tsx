import React from 'react';
import styled from '@emotion/styled';
import first from 'lodash/first';
import last from 'lodash/last';

import {Hovercard} from 'sentry/components/hovercard';
import TextOverflow from 'sentry/components/textOverflow';
import Tooltip from 'sentry/components/tooltip';
import {tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {BreadcrumbTypeNavigation, Crumb} from 'sentry/types/breadcrumbs';
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
  const firstUrl = first(crumbs)?.data?.to;
  const summarizedCrumbs = crumbs.slice(1, -1) as Crumb[];
  const lastUrl = last(crumbs)?.data?.to;

  if (crumbs.length === 0) {
    // This one shouldn't overflow, but by including the component css stays
    // consistent with the other Segment types
    return [
      <Span key="summary">
        <TextOverflow>{tn('%s Page', '%s Pages', 0)}</TextOverflow>
      </Span>,
    ];
  }

  if (crumbs.length === 1) {
    return [
      <SingleLinkSegment
        key="single"
        path={firstUrl}
        onClick={onClick ? () => onClick(first(crumbs) as Crumb) : null}
      />,
    ];
  }

  if (crumbs.length === 2) {
    return [
      <SingleLinkSegment
        key="first"
        path={firstUrl}
        onClick={onClick ? () => onClick(first(crumbs) as Crumb) : null}
      />,
      <SingleLinkSegment
        key="last"
        path={lastUrl}
        onClick={onClick ? () => onClick(last(crumbs) as Crumb) : null}
      />,
    ];
  }

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
  const summaryItems = crumbs.map(crumb => (
    <BreadcrumbItem
      key={crumb.id}
      crumb={crumb}
      startTimestampMs={startTimestampMs}
      isHovered={false}
      isSelected={false}
      onClick={handleOnClick}
    />
  ));

  return (
    <Span>
      <HalfPaddingHovercard body={summaryItems} position="right">
        <TextOverflow>{tn('%s Page', '%s Pages', summaryItems.length)}</TextOverflow>
      </HalfPaddingHovercard>
    </Span>
  );
}

const Span = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 0;
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
