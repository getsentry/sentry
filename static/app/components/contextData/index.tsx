import {isValidElement} from 'react';
import styled from '@emotion/styled';
import isNumber from 'lodash/isNumber';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {isUrl} from 'sentry/utils';

import Toggle from './toggle';
import {analyzeStringForRepr, naturalCaseInsensitiveSort} from './utils';

type Props = React.HTMLAttributes<HTMLPreElement> & {
  data?: React.ReactNode;
  jsonConsts?: boolean;
  maxDefaultDepth?: number;
  meta?: Record<any, any>;
  preserveQuotes?: boolean;
  withAnnotatedText?: boolean;
};

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
  jsonConsts,
  meta,
}: {
  depth: number;
  value?: React.ReactNode;
} & Pick<
  Props,
  'withAnnotatedText' | 'preserveQuotes' | 'jsonConsts' | 'meta' | 'maxDefaultDepth'
>) {
  let i = 0;

  const children: React.ReactNode[] = [];

  if (value === null) {
    return (
      <ValueNull>
        <AnnotatedText value={jsonConsts ? 'null' : 'None'} meta={meta?.[''] ?? meta} />
      </ValueNull>
    );
  }

  if (value === true || value === false) {
    return (
      <ValueBoolean>
        <AnnotatedText
          value={jsonConsts ? (value ? 'true' : 'false') : value ? 'True' : 'False'}
          meta={meta?.[''] ?? meta}
        />
      </ValueBoolean>
    );
  }

  if (typeof value === 'string') {
    const valueInfo = analyzeStringForRepr(value);

    const annotatedValue = withAnnotatedText ? (
      <AnnotatedText value={valueInfo.repr} meta={meta?.[''] ?? meta} />
    ) : (
      valueInfo.repr
    );

    const printedValue = preserveQuotes ? `"${annotatedValue}"` : annotatedValue;

    if (valueInfo.isStripped) {
      return <ValueStrippedString>{printedValue}</ValueStrippedString>;
    }

    if (valueInfo.isMultiLine) {
      return (
        <ValueMultiLineString>
          {printedValue}
          <LinkHint value={value} />
        </ValueMultiLineString>
      );
    }

    return (
      <span>
        {printedValue}
        <LinkHint value={value} />
      </span>
    );
  }

  if (isNumber(value)) {
    const valueToBeReturned =
      withAnnotatedText && meta ? (
        <AnnotatedText value={value} meta={meta?.[''] ?? meta} />
      ) : (
        value
      );
    return <span>{valueToBeReturned}</span>;
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
            jsonConsts,
            meta: meta?.[i]?.[''] ?? meta?.[i] ?? meta?.[''] ?? meta,
          })}
          {i < value.length - 1 ? <span>{', '}</span> : null}
        </div>
      );
    }
    return (
      <span>
        <span>{'['}</span>
        <Toggle highUp={depth <= maxDepth}>{children}</Toggle>
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
            jsonConsts,
            meta: meta?.[key]?.[''] ?? meta?.[key] ?? meta?.[''] ?? meta,
          })}
          {i < keys.length - 1 ? <span>{', '}</span> : null}
        </span>
      </div>
    );
  }

  return (
    <span>
      <span>{'{'}</span>
      <Toggle highUp={depth <= maxDepth - 1}>{children}</Toggle>
      <span>{'}'}</span>
    </span>
  );
}

function ContextData({
  children,
  meta,
  jsonConsts,
  maxDefaultDepth,
  data = null,
  preserveQuotes = false,
  withAnnotatedText = false,
  ...props
}: Props) {
  return (
    <pre {...props}>
      {walk({
        value: data,
        depth: 0,
        maxDefaultDepth,
        meta,
        jsonConsts,
        withAnnotatedText,
        preserveQuotes,
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

const ValueMultiLineString = styled('span')`
  color: var(--prism-selector);
  display: block;
  overflow: auto;
  border-radius: 4px;
  padding: 2px 4px;
`;

const ValueStrippedString = styled('span')`
  font-weight: bold;
  color: var(--prism-keyword);
`;

const ValueObjectKey = styled('span')`
  color: var(--prism-keyword);
`;
