import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import TextOverflow from 'sentry/components/textOverflow';
import {tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {BreadcrumbType, Crumb} from 'sentry/types/breadcrumbs';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';

type MaybeOnClickHandler = null | ((crumb: Crumb) => void);

function getUrl(crumb: undefined | Crumb) {
  if (crumb?.type === BreadcrumbType.NAVIGATION) {
    return crumb.data?.to?.split('?')?.[0];
  }
  if (crumb?.type === BreadcrumbType.INIT) {
    return crumb.data?.url;
  }
  return undefined;
}

function splitCrumbs({
  crumbs,
  onClick,
  startTimestampMs,
}: {
  crumbs: Crumb[];
  onClick: MaybeOnClickHandler;
  startTimestampMs: number;
}) {
  const firstCrumb = crumbs.slice(0, 1) as Crumb[];
  const summarizedCrumbs = crumbs.slice(1, -1) as Crumb[];
  const lastCrumb = crumbs.slice(-1) as Crumb[];

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
      <SummarySegment
        key="first"
        crumbs={firstCrumb}
        startTimestampMs={startTimestampMs}
        handleOnClick={onClick}
      />,
      <SummarySegment
        key="summary"
        crumbs={summarizedCrumbs}
        startTimestampMs={startTimestampMs}
        handleOnClick={onClick}
      />,
      <SummarySegment
        key="last"
        crumbs={lastCrumb}
        startTimestampMs={startTimestampMs}
        handleOnClick={onClick}
      />,
    ];
  }

  return crumbs.map((crumb, i) => (
    <SummarySegment
      key={i}
      crumbs={[crumb] as Crumb[]}
      startTimestampMs={startTimestampMs}
      handleOnClick={onClick}
    />
  ));
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
            onClick={handleOnClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            startTimestampMs={startTimestampMs}
          />
        </li>
      ))}
    </ScrollingList>
  );

  const label =
    crumbs.length === 1 ? getUrl(crumbs[0]) : tn('%s Page', '%s Pages', crumbs.length);
  return (
    <Span>
      <HalfPaddingHovercard body={summaryItems} position="right">
        <TextOverflow>{label}</TextOverflow>
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
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 0;
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
