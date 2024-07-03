import {Fragment} from 'react';
import styled from '@emotion/styled';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {StructuredData} from 'sentry/components/structuredEventData';
import Timeline from 'sentry/components/timeline';
import {space} from 'sentry/styles/space';
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
import {usePrismTokens} from 'sentry/utils/usePrismTokens';

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
  const tokens = usePrismTokens({code: breadcrumb?.message ?? '', language: 'sql'});
  return (
    <Timeline.Data>
      <LightenTextColor className="language-sql">
        {tokens.map((line, i) => (
          <div key={i}>
            {line.map((token, j) => (
              <span key={j} className={token.className}>
                {token.children}
              </span>
            ))}
          </div>
        ))}
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

const LightenTextColor = styled('pre')`
  margin: 0;
  &.language-sql {
    color: ${p => p.theme.subText};
    padding: ${space(0.25)} 0;
    font-size: ${p => p.theme.fontSizeSmall};
  }
`;
