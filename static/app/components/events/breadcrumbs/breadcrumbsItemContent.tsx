import {Fragment} from 'react';
import styled from '@emotion/styled';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {Sql} from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/data/sql';
import {StructuredData} from 'sentry/components/structuredEventData';
import Timeline from 'sentry/components/timeline';
import {
  BreadcrumbMessageFormat,
  BreadcrumbType,
  type BreadcrumbTypeDefault,
  type BreadcrumbTypeHTTP,
  type BreadcrumbTypeNavigation,
  type RawCrumb,
} from 'sentry/types/breadcrumbs';
import {defined} from 'sentry/utils';
import {isUrl} from 'sentry/utils/string/isUrl';

interface BreadcrumbsItemContentProps {
  breadcrumb: RawCrumb;
  fullyExpanded?: boolean;
  meta?: Record<string, any>;
}

export default function BreadcrumbsItemContent({
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
    return (
      <HTTPCrumbContent breadcrumb={bc} meta={meta}>
        {defaultMessage}
      </HTTPCrumbContent>
    );
  }

  if (
    !defined(meta) &&
    bc?.message &&
    bc?.messageFormat === BreadcrumbMessageFormat.SQL
  ) {
    return <SQLCrumbContent breadcrumb={bc} />;
  }

  if (bc?.type === BreadcrumbType.WARNING || bc?.type === BreadcrumbType.ERROR) {
    return <ErrorCrumbContent breadcrumb={bc}>{defaultMessage}</ErrorCrumbContent>;
  }

  return (
    <Fragment>
      {defaultMessage}
      {defaultData}
    </Fragment>
  );
}

function HTTPCrumbContent({
  breadcrumb,
  meta,
  children = null,
}: {
  breadcrumb: BreadcrumbTypeHTTP;
  children?: React.ReactNode;
  meta?: Record<string, any>;
}) {
  const {method, url, status_code: statusCode, ...otherData} = breadcrumb?.data ?? {};
  return (
    <Fragment>
      {children}
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
      {Object.keys(otherData).length > 0 ? (
        <Timeline.Data>
          <StructuredData
            value={otherData}
            meta={meta}
            depth={0}
            maxDefaultDepth={2}
            withAnnotatedText
            withOnlyFormattedText
          />
        </Timeline.Data>
      ) : null}
    </Fragment>
  );
}

function SQLCrumbContent({
  breadcrumb,
}: {
  breadcrumb: BreadcrumbTypeDefault | BreadcrumbTypeNavigation;
}) {
  return (
    <Timeline.Data>
      <LightenTextColor>
        <Sql breadcrumb={breadcrumb} searchTerm="" />
      </LightenTextColor>
    </Timeline.Data>
  );
}

function ErrorCrumbContent({
  breadcrumb,
  children = null,
}: {
  breadcrumb: BreadcrumbTypeDefault;
  children?: React.ReactNode;
}) {
  return (
    <Fragment>
      <Timeline.Text>
        {breadcrumb?.data?.type && `${breadcrumb?.data?.type}: `}
        {breadcrumb?.data?.value}
      </Timeline.Text>
      {children}
    </Fragment>
  );
}

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
