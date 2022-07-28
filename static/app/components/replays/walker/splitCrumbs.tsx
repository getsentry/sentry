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

function splitCrumbs({
  crumbs,
  startTimestamp,
}: {
  crumbs: BreadcrumbTypeNavigation[];
  startTimestamp: number;
}) {
  const firstUrl = first(crumbs)?.data?.to;
  const summarizedCrumbs = crumbs.slice(1, -1) as Crumb[];
  const lastUrl = last(crumbs)?.data?.to;

  if (crumbs.length === 0) {
    // This one shouldn't overflow, but by including the component css stays
    // consistent with the other Segment types
    return [
      <Span key="summary">
        <TextOverflow>{tn('%s Transaction', '%s Transactions', 0)}</TextOverflow>
      </Span>,
    ];
  }

  if (crumbs.length === 1) {
    return [<SingleLinkSegment key="single" path={firstUrl} />];
  }

  if (crumbs.length === 2) {
    return [
      <SingleLinkSegment key="first" path={firstUrl} />,
      <SingleLinkSegment key="last" path={lastUrl} />,
    ];
  }

  return [
    <SingleLinkSegment key="first" path={firstUrl} />,
    <SummarySegment
      key="summary"
      crumbs={summarizedCrumbs}
      startTimestamp={startTimestamp}
    />,
    <SingleLinkSegment key="last" path={lastUrl} />,
  ];
}

function SingleLinkSegment({path}: {path: undefined | string}) {
  if (!path) {
    return null;
  }
  return (
    <Link href="#">
      <Tooltip title={path}>
        <TextOverflow ellipsisDirection="left">{path}</TextOverflow>
      </Tooltip>
    </Link>
  );
}

function SummarySegment({
  crumbs,
  startTimestamp,
}: {
  crumbs: Crumb[];
  startTimestamp: number;
}) {
  const summaryItems = crumbs.map(crumb => (
    <BreadcrumbItem
      key={crumb.id}
      crumb={crumb}
      startTimestamp={startTimestamp}
      isHovered={false}
      isSelected={false}
      onClick={() => {}}
    />
  ));

  return (
    <Span>
      <HalfPaddingHovercard
        body={summaryItems}
        bodyClassName="half-padding"
        position="right"
      >
        <TextOverflow>
          {tn('%s Transaction', '%s Transactions', summaryItems.length)}
        </TextOverflow>
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

const HalfPaddingHovercard = styled(Hovercard)`
  .half-padding {
    padding: ${space(0.5)};
  }
`;

export default splitCrumbs;
