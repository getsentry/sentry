import {Fragment} from 'react';
import styled from '@emotion/styled';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {
  BREADCRUMB_TIMESTAMP_PLACEHOLDER,
  BreadcrumbIcon,
  BreadcrumbTag,
  getBreadcrumbColorConfig,
  getBreadcrumbTitle,
} from 'sentry/components/events/breadcrumbs/utils';
import {Sql} from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/data/sql';
import {StructuredData} from 'sentry/components/structuredEventData';
import Timeline, {type TimelineItemProps} from 'sentry/components/timeline';
import {t} from 'sentry/locale';
import {
  BreadcrumbMessageFormat,
  BreadcrumbType,
  type RawCrumb,
} from 'sentry/types/breadcrumbs';
import {defined} from 'sentry/utils';
import {isUrl} from 'sentry/utils/string/isUrl';

interface BreadcrumbsTimelineProps {
  breadcrumbs: RawCrumb[];
  fullyExpanded?: boolean;
  meta?: Record<string, any>;
  startTimeString?: TimelineItemProps['startTimeString'];
  virtualCrumbIndex?: number;
}

export default function BreadcrumbsTimeline({
  breadcrumbs,
  startTimeString,
  virtualCrumbIndex,
  meta = {},
  fullyExpanded = false,
}: BreadcrumbsTimelineProps) {
  if (!breadcrumbs.length) {
    return null;
  }

  const items = breadcrumbs.map((bc, i) => {
    const bcMeta = meta[i];
    const isVirtualCrumb = defined(virtualCrumbIndex) && i === virtualCrumbIndex;
    return (
      <Timeline.Item
        key={i}
        title={
          <Fragment>
            {getBreadcrumbTitle(bc.category)}
            {isVirtualCrumb && <Subtitle> - {t('This event')}</Subtitle>}
            <BreadcrumbTag level={bc.level} />
          </Fragment>
        }
        colorConfig={getBreadcrumbColorConfig(bc.type)}
        icon={<BreadcrumbIcon type={bc.type} />}
        timeString={bc.timestamp ?? BREADCRUMB_TIMESTAMP_PLACEHOLDER}
        startTimeString={startTimeString}
        // XXX: Only the virtual crumb can be marked as active for breadcrumbs
        isActive={isVirtualCrumb ?? false}
        style={{background: 'transparent'}}
      >
        <BreadcrumbsItemContent
          breadcrumb={bc}
          meta={bcMeta}
          fullyExpanded={fullyExpanded}
        />
      </Timeline.Item>
    );
  });

  return <Timeline.Container>{items}</Timeline.Container>;
}

interface BreadcrumbsItemContentProps {
  breadcrumb: RawCrumb;
  fullyExpanded?: boolean;
  meta?: Record<string, any>;
}

function BreadcrumbsItemContent({
  breadcrumb: bc,
  meta,
  fullyExpanded,
}: BreadcrumbsItemContentProps) {
  const maxDefaultDepth = fullyExpanded ? 10000 : 1;
  const structureProps = {
    depth: 0,
    maxDefaultDepth,
    withAnnotatedText: true,
    withOnlyFormattedText: true,
  };

  const defaultMessage = defined(bc.message) ? (
    <Timeline.Text>
      <StructuredData value={bc.message} meta={meta?.message} {...structureProps} />
    </Timeline.Text>
  ) : null;
  const defaultData = defined(bc.data) ? (
    <Timeline.Data>
      <StructuredData value={bc.data} meta={meta?.data} {...structureProps} />
    </Timeline.Data>
  ) : null;

  if (bc?.type === BreadcrumbType.HTTP) {
    const {method, url, status_code: statusCode, ...otherData} = bc.data;

    return (
      <Fragment>
        {defaultMessage}
        <Timeline.Text>
          {method && `${method}: `}
          {url && isUrl(url) ? (
            <Link onClick={() => openNavigateToExternalLinkModal({linkText: url})}>
              {url}
            </Link>
          ) : (
            url
          )}
          {` [${statusCode}]`}
        </Timeline.Text>
        {defined(bc.data) ? (
          <Timeline.Data>
            <StructuredData value={otherData} meta={meta?.data} {...structureProps} />
          </Timeline.Data>
        ) : null}
      </Fragment>
    );
  }

  if (
    !defined(meta) &&
    bc?.message &&
    bc?.messageFormat === BreadcrumbMessageFormat.SQL
  ) {
    return (
      <Timeline.Data>
        <LightenTextColor>
          <Sql breadcrumb={bc} searchTerm="" />
        </LightenTextColor>
      </Timeline.Data>
    );
  }
  if (
    (!defined(meta) && bc?.type === BreadcrumbType.WARNING) ||
    bc?.type === BreadcrumbType.ERROR
  ) {
    return (
      <Fragment>
        <Timeline.Text>
          {bc?.data?.type && `${bc?.data?.type}: `}
          {bc?.data?.value}
        </Timeline.Text>
        {defaultMessage}
      </Fragment>
    );
  }

  return (
    <Fragment>
      {defaultMessage}
      {defaultData}
    </Fragment>
  );
}

const Subtitle = styled('p')`
  margin: 0;
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeSmall};
  display: inline;
`;

const Link = styled('a')`
  color: ${p => p.theme.subText};
  text-decoration: underline;
  text-decoration-style: dotted;
  word-break: break-all;
`;

const LightenTextColor = styled('div')`
  .token {
    color: ${p => p.theme.subText};
  }
`;
