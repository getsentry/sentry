import {isValidElement} from 'react';
import styled from '@emotion/styled';
import isArray from 'lodash/isArray';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {AnnotatedEllipsis} from 'sentry/components/events/meta/annotatedText/annotatedEllipsis';
import {
  getChildMetaContainer,
  getMeta,
  MetaContainer,
} from 'sentry/components/events/meta/metaContainer';
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
  meta?: MetaContainer;
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
        <AnnotatedText value={jsonConsts ? 'null' : 'None'} meta={getMeta(meta)} />
      </span>
    );
  }

  if (value === true || value === false) {
    return (
      <span className="val-bool">
        <AnnotatedText
          value={jsonConsts ? (value ? 'true' : 'false') : value ? 'True' : 'False'}
          meta={getMeta(meta)}
        />
      </span>
    );
  }

  if (isString(value)) {
    const valueInfo = analyzeStringForRepr(value);

    const valueToBeReturned = withAnnotatedText ? (
      <AnnotatedText value={valueInfo.repr} meta={getMeta(meta)} />
    ) : (
      valueInfo.repr
    );

    const valueNodes = [<span key="value">{valueToBeReturned}</span>];

    if (preserveQuotes) {
      valueNodes.unshift(<span key="open-quote">"</span>);
      valueNodes.push(<span key="close-quote">"</span>);
    }

    const out = [
      <span
        key="value"
        className={
          (valueInfo.isString ? 'val-string' : '') +
          (valueInfo.isStripped ? ' val-stripped' : '') +
          (valueInfo.isMultiLine ? ' val-string-multiline' : '')
        }
      >
        {valueNodes}
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
        <AnnotatedText value={value} meta={getMeta(meta)} />
      ) : (
        value
      );
    return <span>{valueToBeReturned}</span>;
  }

  if (isArray(value)) {
    const metaLength = getMeta(meta)?.len ?? value.length;
    for (i = 0; i < value.length; i++) {
      children.push(
        <span className="val-array-item" key={i}>
          {walk({
            value: value[i],
            depth: depth + 1,
            preserveQuotes,
            withAnnotatedText,
            jsonConsts,
            meta: getChildMetaContainer(meta, i),
          })}
          {i < value.length - 1 ? <span className="val-array-sep">{', '}</span> : null}
        </span>
      );
    }

    if (metaLength > value.length) {
      children.push(
        <span className="val-array-item" key="ellipsis">
          <AnnotatedEllipsis
            container="array"
            metaLength={metaLength}
            withAnnotatedText={withAnnotatedText}
          />
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
  const metaLength = getMeta(meta)?.len ?? keys.length;

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
            meta: getChildMetaContainer(meta, key),
          })}
          {i < metaLength - 1 ? <span className="val-dict-sep">{', '}</span> : null}
        </span>
      </span>
    );
  }
  if (metaLength > keys.length) {
    children.push(
      <span className="val-dict-pair" key="ellipsis">
        <AnnotatedEllipsis
          container="object"
          metaLength={metaLength}
          withAnnotatedText={withAnnotatedText}
        />
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
