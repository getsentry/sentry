import {Fragment, isValidElement} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types';
import {isUrl} from 'sentry/utils';

import Toggle from './toggle';
import {
  looksLikeBooleanValue,
  looksLikeMultiLineString,
  looksLikeNullValue,
  looksLikeNumberValue,
  looksLikeStringValue,
  looksLikeStrippedValue,
  naturalCaseInsensitiveSort,
  printBooleanValue,
  printMultilineString,
  printNullValue,
  printStringValue,
} from './utils';

type Props = React.HTMLAttributes<HTMLPreElement> & {
  data?: React.ReactNode;
  maxDefaultDepth?: number;
  meta?: Record<any, any>;
  preserveQuotes?: boolean;
  syntax?: PlatformKey;
  withAnnotatedText?: boolean;
};

interface WalkProps
  extends Required<
    Pick<Props, 'withAnnotatedText' | 'preserveQuotes' | 'maxDefaultDepth'>
  > {
  depth: number;
  meta: Record<any, any> | undefined;
  syntax: PlatformKey | undefined;
  value?: React.ReactNode;
}

function ContextValue({
  value,
  withAnnotatedText,
  meta,
}: Pick<WalkProps, 'value' | 'withAnnotatedText' | 'meta'>) {
  if (!withAnnotatedText || !meta) {
    return <Fragment>{value}</Fragment>;
  }

  return <AnnotatedText value={value} meta={meta?.[''] ?? meta} />;
}

function LinkHint({value}: {value: string}) {
  if (!isUrl(value)) {
    return null;
  }

  return (
    <ExternalLink href={value} className="external-icon">
      <StyledIconOpen size="xs" aria-label={t('Open link')} />
    </ExternalLink>
  );
}

function walk({
  depth,
  value = null,
  maxDefaultDepth: maxDepth = 2,
  preserveQuotes,
  withAnnotatedText,
  meta,
  syntax,
}: WalkProps) {
  let i = 0;

  const children: React.ReactNode[] = [];

  if (value === null || looksLikeNullValue(value, syntax)) {
    return (
      <ValueNull>
        <ContextValue
          withAnnotatedText={withAnnotatedText}
          value={printNullValue(syntax)}
          meta={meta}
        />
      </ValueNull>
    );
  }

  if (typeof value === 'boolean' || looksLikeBooleanValue(value, syntax)) {
    return (
      <ValueBoolean>
        <ContextValue
          withAnnotatedText={withAnnotatedText}
          value={printBooleanValue(value, syntax)}
          meta={meta}
        />
      </ValueBoolean>
    );
  }

  if (typeof value === 'string') {
    if (looksLikeStrippedValue(value)) {
      return (
        <ValueStrippedString>
          <ContextValue withAnnotatedText={withAnnotatedText} meta={meta} value={value} />
        </ValueStrippedString>
      );
    }

    if (preserveQuotes) {
      return (
        <ValueString>
          <ContextValue
            withAnnotatedText={withAnnotatedText}
            meta={meta}
            value={`"${value}"`}
          />
          <LinkHint value={value} />
        </ValueString>
      );
    }

    if (looksLikeMultiLineString(value, syntax)) {
      return (
        <ValueMultiLineString>
          <ContextValue
            withAnnotatedText={withAnnotatedText}
            value={printMultilineString(value, syntax)}
            meta={meta}
          />
        </ValueMultiLineString>
      );
    }

    if (looksLikeNumberValue(value, syntax)) {
      return (
        <ValueNumber>
          <ContextValue withAnnotatedText={withAnnotatedText} value={value} meta={meta} />
        </ValueNumber>
      );
    }

    if (looksLikeStringValue(value, syntax)) {
      return (
        <Fragment>
          <ValueString>
            <ContextValue
              withAnnotatedText={withAnnotatedText}
              value={printStringValue(value, syntax)}
              meta={meta}
            />
          </ValueString>
          <LinkHint value={value} />
        </Fragment>
      );
    }

    return (
      <span>
        <ContextValue
          withAnnotatedText={withAnnotatedText}
          meta={meta}
          value={preserveQuotes ? `${value}` : value}
        />
        <LinkHint value={value} />
      </span>
    );
  }

  if (typeof value === 'number') {
    return (
      <ValueNumber>
        <ContextValue withAnnotatedText={withAnnotatedText} value={value} meta={meta} />
      </ValueNumber>
    );
  }

  if (Array.isArray(value)) {
    for (i = 0; i < value.length; i++) {
      children.push(
        <div key={i}>
          {walk({
            value: value[i],
            depth: depth + 1,
            preserveQuotes,
            withAnnotatedText,
            syntax,
            meta: meta?.[i],
            maxDefaultDepth: maxDepth,
          })}
          {i < value.length - 1 ? <span>{', '}</span> : null}
        </div>
      );
    }
    return (
      <span>
        <span>{'['}</span>
        <ClassNames>
          {({css}) => (
            <Toggle
              highUp={depth <= maxDepth}
              wrapClassName={css`
                display: block;
                padding: 0 0 0 15px;
              `}
            >
              {children}
            </Toggle>
          )}
        </ClassNames>
        <span>{']'}</span>
      </span>
    );
  }

  if (isValidElement(value)) {
    return value;
  }

  const keys = Object.keys(value);

  keys.sort(naturalCaseInsensitiveSort);

  for (i = 0; i < keys.length; i++) {
    const key = keys[i];

    children.push(
      <div key={key}>
        <ValueObjectKey>{preserveQuotes ? `"${key}"` : key}</ValueObjectKey>
        <span>{': '}</span>
        <span>
          {walk({
            value: value[key],
            depth: depth + 1,
            preserveQuotes,
            withAnnotatedText,
            meta: meta?.[key],
            syntax,
            maxDefaultDepth: maxDepth,
          })}
          {i < keys.length - 1 ? <span>{', '}</span> : null}
        </span>
      </div>
    );
  }

  return (
    <span>
      <span>{'{'}</span>
      <ClassNames>
        {({css}) => (
          <Toggle
            highUp={depth <= maxDepth - 1}
            wrapClassName={css`
              display: block;
              padding: 0 0 0 15px;
            `}
          >
            {children}
          </Toggle>
        )}
      </ClassNames>
      <span>{'}'}</span>
    </span>
  );
}

function ContextData({
  children,
  meta,
  maxDefaultDepth = 2,
  data = null,
  preserveQuotes = false,
  withAnnotatedText = false,
  syntax,
  ...props
}: Props) {
  return (
    <pre {...props}>
      {walk({
        value: data,
        depth: 0,
        maxDefaultDepth,
        meta,
        withAnnotatedText,
        preserveQuotes,
        syntax,
      })}
      {children}
    </pre>
  );
}

export default ContextData;

const StyledIconOpen = styled(IconOpen)`
  position: relative;
  top: 1px;
`;

const ValueNull = styled('span')`
  font-weight: bold;
  color: var(--prism-property);
`;

const ValueBoolean = styled('span')`
  font-weight: bold;
  color: var(--prism-property);
`;

const ValueString = styled('span')`
  color: var(--prism-selector);
`;

const ValueMultiLineString = styled('span')`
  color: var(--prism-selector);
  display: block;
  white-space: pre-wrap;
  overflow: auto;
  border-radius: 4px;
  padding: 2px 4px;
`;

const ValueStrippedString = styled('span')`
  font-weight: bold;
  color: var(--prism-keyword);
`;

const ValueNumber = styled('span')`
  color: var(--prism-property);
`;

const ValueObjectKey = styled('span')`
  color: var(--prism-keyword);
`;
