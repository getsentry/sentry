import {Fragment} from 'react';
import styled from '@emotion/styled';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {StructuredData} from 'sentry/components/structuredEventData';
import {Timeline} from 'sentry/components/timeline';
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
import {ellipsize} from 'sentry/utils/string/ellipsize';
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
          value={ellipsize(bc.message, MESSAGE_PREVIEW_CHAR_LIMIT)}
          // Note: Annotations applying to trimmed content will not be applied.
          meta={meta?.message}
          {...structuredDataProps}
        />
      )}
    </BreadcrumbText>
  ) : null;

  const cleanedBreadcrumbData = cleanBreadcrumbData(bc.data);

  const defaultData = defined(cleanedBreadcrumbData) ? (
    <Timeline.Data>
      <StructuredData
        value={cleanedBreadcrumbData}
        meta={meta?.data}
        {...structuredDataProps}
      />
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
  const {
    method,
    url,
    status_code: statusCode,
    ...otherData
  } = cleanBreadcrumbData(breadcrumb?.data) ?? {};
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

const formatValue = (val: unknown): string => {
  if (val === null || val === undefined) {
    return '';
  }
  if (Array.isArray(val)) {
    // Array might contain objects
    return val.map(item => formatValue(item)).join(', ');
  }
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return `${val as string | number}`;
};

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

  const hasValue = value !== null && value !== undefined && value !== '';
  const formattedValue = hasValue ? formatValue(value) : '';

  return (
    <Fragment>
      <BreadcrumbText>
        {type ? type : null}
        {type && hasValue ? `: ${formattedValue}` : hasValue ? formattedValue : null}
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

function cleanBreadcrumbData<B extends Record<string, any> | undefined | null>(
  breadcrumbData: B
): B {
  if (!breadcrumbData) {
    return breadcrumbData;
  }

  const cleanedBreadcrumbData = {...breadcrumbData};

  // The JS SDK emits the __span property since forever (3+ years).
  // Originally it was introduced to potentially be able to go from the breadcrumb to a particular span within a trace.
  // Up until now, this link wasn't built. Showing the span property is extremely noisy within the interface so we hide it.
  // We can at any point in time use this data again to link to a trace, however, to be able to link to a trace we need to be sure that the trace actually exists.
  if ('__span' in cleanedBreadcrumbData) {
    delete cleanedBreadcrumbData.__span;
  }

  return cleanedBreadcrumbData;
}

const Link = styled('a')`
  color: ${p => p.theme.tokens.content.primary};
  text-decoration: underline;
  text-decoration-style: dotted;
  word-break: break-all;
`;

const SQLText = styled('pre')`
  &.language-sql {
    margin: 0;
    padding: ${space(0.25)} 0;
    font-size: ${p => p.theme.fontSize.sm};
    white-space: pre-wrap;
  }
`;

const BreadcrumbText = styled(Timeline.Text)`
  white-space: pre-wrap;
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.primary};
`;
