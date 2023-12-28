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
      <span className="val-null">
        <AnnotatedText value={jsonConsts ? 'null' : 'None'} meta={meta?.[''] ?? meta} />
      </span>
    );
  }

  if (value === true || value === false) {
    return (
      <span className="val-bool">
        <AnnotatedText
          value={jsonConsts ? (value ? 'true' : 'false') : value ? 'True' : 'False'}
          meta={meta?.[''] ?? meta}
        />
      </span>
    );
  }

  if (typeof value === 'string') {
    const valueInfo = analyzeStringForRepr(value);

    const valueToBeReturned = withAnnotatedText ? (
      <AnnotatedText value={valueInfo.repr} meta={meta?.[''] ?? meta} />
    ) : (
      valueInfo.repr
    );

    const out = [
      <span
        key="value"
        className={
          (valueInfo.isString ? 'val-string' : '') +
          (valueInfo.isStripped ? ' val-stripped' : '') +
          (valueInfo.isMultiLine ? ' val-string-multiline' : '')
        }
      >
        {preserveQuotes ? `"${valueToBeReturned}"` : valueToBeReturned}
      </span>,
    ];

    if (valueInfo.isString && isUrl(value)) {
      out.push(
        <ExternalLink key="external" href={value} className="external-icon">
          <StyledIconOpen size="xs" aria-label={t('Open link')} />
        </ExternalLink>
      );
    }

    return out;
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
        <span className="val-array-item" key={i}>
          {walk({
            value: value[i],
            depth: depth + 1,
            preserveQuotes,
            withAnnotatedText,
            jsonConsts,
            meta: meta?.[i]?.[''] ?? meta?.[i] ?? meta?.[''] ?? meta,
          })}
          {i < value.length - 1 ? <span className="val-array-sep">{', '}</span> : null}
        </span>
      );
    }
    return (
      <span className="val-array">
        <span className="val-array-marker">{'['}</span>
        <Toggle highUp={depth <= maxDepth} wrapClassName="val-array-items">
          {children}
        </Toggle>
        <span className="val-array-marker">{']'}</span>
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
      <span className="val-dict-pair" key={key}>
        <span className="val-dict-key">
          <span className="val-string">{preserveQuotes ? `"${key}"` : key}</span>
        </span>
        <span className="val-dict-col">{': '}</span>
        <span className="val-dict-value">
          {walk({
            value: value[key],
            depth: depth + 1,
            preserveQuotes,
            withAnnotatedText,
            jsonConsts,
            meta: meta?.[key]?.[''] ?? meta?.[key] ?? meta?.[''] ?? meta,
          })}
          {i < keys.length - 1 ? <span className="val-dict-sep">{', '}</span> : null}
        </span>
      </span>
    );
  }

  return (
    <span className="val-dict">
      <span className="val-dict-marker">{'{'}</span>
      <Toggle highUp={depth <= maxDepth - 1} wrapClassName="val-dict-items">
        {children}
      </Toggle>
      <span className="val-dict-marker">{'}'}</span>
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
