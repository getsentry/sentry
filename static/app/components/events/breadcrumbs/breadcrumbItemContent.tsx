import {Fragment} from 'react';
import styled from '@emotion/styled';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
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

const DEFAULT_STRUCTURED_DATA_PROPS = {
  maxDefaultDepth: 1,
  withAnnotatedText: true,
  withOnlyFormattedText: true,
};

const MESSAGE_PREVIEW_CHAR_LIMIT = 200;

interface BreadcrumbItemContentProps {
  breadcrumb: RawCrumb;
  fullyExpanded?: boolean;
  meta?: Record<string, any>;
}

export default function BreadcrumbItemContent({
  breadcrumb: bc,
  meta,
  fullyExpanded = true,
}: BreadcrumbItemContentProps) {
  const structuredDataProps = {
    ...DEFAULT_STRUCTURED_DATA_PROPS,
    maxDefaultDepth: fullyExpanded
      ? 10000
      : DEFAULT_STRUCTURED_DATA_PROPS.maxDefaultDepth,
    autoCollapseLimit: fullyExpanded ? 10000 : undefined,
  };

  const defaultMessage = defined(bc.message) ? (
    <BreadcrumbText>
      {fullyExpanded ? (
        <StructuredData
          value={bc.message}
          meta={meta?.message}
          {...structuredDataProps}
        />
      ) : (
        <StructuredData
          value={
            bc.message.length > MESSAGE_PREVIEW_CHAR_LIMIT
              ? bc.message.substring(0, MESSAGE_PREVIEW_CHAR_LIMIT) + '\u2026'
              : bc.message
          }
          // Note: Annotations applying to trimmed content will not be applied.
          meta={meta?.message}
          {...structuredDataProps}
        />
      )}
    </BreadcrumbText>
  ) : null;
  const defaultData = defined(bc.data) ? (
    <Timeline.Data>
      <StructuredData value={bc.data} meta={meta?.data} {...structuredDataProps} />
    </Timeline.Data>
  ) : null;

  if (bc?.type === BreadcrumbType.HTTP) {
    return (
      <HTTPCrumbContent
        breadcrumb={bc}
        meta={meta}
        structuredDataProps={structuredDataProps}
      >
        {defaultMessage}
      </HTTPCrumbContent>
    );
  }

  if (
    !defined(meta) &&
    bc?.message &&
    bc?.messageFormat === BreadcrumbMessageFormat.SQL
  ) {
    return <SQLCrumbContent breadcrumb={bc}>{defaultData}</SQLCrumbContent>;
  }

  if (bc?.type === BreadcrumbType.WARNING || bc?.type === BreadcrumbType.ERROR) {
    return (
      <ExceptionCrumbContent
        breadcrumb={bc}
        meta={meta}
        structuredDataProps={structuredDataProps}
      >
        {defaultMessage}
      </ExceptionCrumbContent>
    );
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
  structuredDataProps,
}: {
  breadcrumb: BreadcrumbTypeHTTP;
  children: React.ReactNode;
  structuredDataProps: typeof DEFAULT_STRUCTURED_DATA_PROPS;
  meta?: Record<string, any>;
}) {
  const {method, url, status_code: statusCode, ...otherData} = breadcrumb?.data ?? {};
  const isValidUrl = !meta && defined(url) && isUrl(url);
  return (
    <Fragment>
      {children}
      <BreadcrumbText>
        {defined(method) && `${method}: `}
        {isValidUrl ? (
          <Link
            role="link"
            onClick={() => openNavigateToExternalLinkModal({linkText: url})}
          >
            {url}
          </Link>
        ) : (
          <AnnotatedText value={url} meta={meta?.data?.url?.['']} />
        )}
        {defined(statusCode) && ` [${statusCode}]`}
      </BreadcrumbText>
      {Object.keys(otherData).length > 0 ? (
        <Timeline.Data>
          <StructuredData value={otherData} meta={meta?.data} {...structuredDataProps} />
        </Timeline.Data>
      ) : null}
    </Fragment>
  );
}

function SQLCrumbContent({
  breadcrumb,
  children,
}: {
  breadcrumb: BreadcrumbTypeDefault | BreadcrumbTypeNavigation;
  children: React.ReactNode;
}) {
  const tokens = usePrismTokens({code: breadcrumb?.message ?? '', language: 'sql'});
  return (
    <Fragment>
      <Timeline.Data>
        <SQLText className="language-sql">
          {tokens.map((line, i) => (
            <div key={i}>
              {line.map((token, j) => (
                <span key={j} className={token.className}>
                  {token.children}
                </span>
              ))}
            </div>
          ))}
        </SQLText>
      </Timeline.Data>
      {children}
    </Fragment>
  );
}

function ExceptionCrumbContent({
  breadcrumb,
  meta,
  children = null,
  structuredDataProps,
}: {
  breadcrumb: BreadcrumbTypeDefault;
  children: React.ReactNode;
  structuredDataProps: typeof DEFAULT_STRUCTURED_DATA_PROPS;
  meta?: Record<string, any>;
}) {
  const {type, value, ...otherData} = breadcrumb?.data ?? {};
  return (
    <Fragment>
      <BreadcrumbText>
        {type && type}
        {type ? value && `: ${value}` : value && value}
      </BreadcrumbText>
      {children}
      {Object.keys(otherData).length > 0 ? (
        <Timeline.Data>
          <StructuredData value={otherData} meta={meta?.data} {...structuredDataProps} />
        </Timeline.Data>
      ) : null}
    </Fragment>
  );
}

const Link = styled('a')`
  color: ${p => p.theme.textColor};
  text-decoration: underline;
  text-decoration-style: dotted;
  word-break: break-all;
`;

const SQLText = styled('pre')`
  &.language-sql {
    margin: 0;
    padding: ${space(0.25)} 0;
    font-size: ${p => p.theme.fontSizeSmall};
    white-space: pre-wrap;
  }
`;

const BreadcrumbText = styled(Timeline.Text)`
  white-space: pre-wrap;
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
  color: ${p => p.theme.textColor};
`;
