import {Fragment, isValidElement} from 'react';
import styled from '@emotion/styled';

import AnnotatedValue from 'sentry/components/structuredEventData/annotatedValue';
import {CollapsibleValue} from 'sentry/components/structuredEventData/collapsibleValue';
import LinkHint from 'sentry/components/structuredEventData/linkHint';
import {
  looksLikeStrippedValue,
  naturalCaseInsensitiveSort,
} from 'sentry/components/structuredEventData/utils';
import containsCRLF from 'sentry/utils/string/containsCRLF';

type Config = {
  isBoolean?: (value: unknown) => boolean;
  isNull?: (value: unknown) => boolean;
  isNumber?: (value: unknown) => boolean;
  isString?: (value: unknown) => boolean;
  renderBoolean?: (value: unknown) => React.ReactNode;
  renderNull?: (value: unknown) => React.ReactNode;
  renderObjectKeys?: (value: string) => string;
  renderString?: (value: string) => string;
};

interface Props {
  meta: Record<any, any> | undefined;
  path: string;
  withAnnotatedText: boolean;
  config?: Config;
  objectKey?: string;
  // TODO(TS): What possible types can `value` be?
  value?: any;
  withOnlyFormattedText?: boolean;
}

export function RecursiveStructuredData({
  config,
  meta,
  objectKey,
  path,
  value = null,
  withAnnotatedText,
  withOnlyFormattedText = false,
}: Props) {
  let i = 0;
  const formattedObjectKey =
    objectKey !== undefined ? (
      <Fragment>
        <ValueObjectKey>
          {config?.renderObjectKeys?.(objectKey) ?? objectKey}
        </ValueObjectKey>
        <span>{': '}</span>
      </Fragment>
    ) : null;

  function Wrapper({children}: {children: React.ReactNode}) {
    return (
      <Fragment>
        {formattedObjectKey}
        {children}
      </Fragment>
    );
  }

  if (config?.isNull?.(value) || value === null) {
    const nullValue = config?.renderNull?.(value) ?? String(value);

    return (
      <Wrapper>
        <ValueNull data-test-id="value-null">
          <AnnotatedValue
            value={nullValue}
            meta={meta}
            withAnnotatedText={withAnnotatedText}
            withOnlyFormattedText={withOnlyFormattedText}
          />
        </ValueNull>
      </Wrapper>
    );
  }

  if (config?.isBoolean?.(value) || value === true || value === false) {
    const booleanValue = config?.renderBoolean?.(value) ?? String(value);

    return (
      <Wrapper>
        <ValueBoolean data-test-id="value-boolean">
          <AnnotatedValue
            value={booleanValue}
            meta={meta}
            withAnnotatedText={withAnnotatedText}
            withOnlyFormattedText={withOnlyFormattedText}
          />
        </ValueBoolean>
      </Wrapper>
    );
  }

  if (typeof value === 'number' || config?.isNumber?.(value)) {
    return (
      <Wrapper>
        <ValueNumber data-test-id="value-number">
          <AnnotatedValue
            value={value}
            meta={meta}
            withAnnotatedText={withAnnotatedText}
            withOnlyFormattedText={withOnlyFormattedText}
          />
        </ValueNumber>
      </Wrapper>
    );
  }

  if (typeof value === 'string') {
    if (config?.isString?.(value)) {
      const stringValue = config.renderString?.(value) ?? value;

      return (
        <Wrapper>
          <ValueString data-test-id="value-string">
            {'"'}
            <AnnotatedValue
              value={stringValue}
              meta={meta}
              withAnnotatedText={withAnnotatedText}
              withOnlyFormattedText={withOnlyFormattedText}
            />
            {'"'}
            <LinkHint meta={meta} value={stringValue} />
          </ValueString>
        </Wrapper>
      );
    }

    if (looksLikeStrippedValue(value)) {
      return (
        <Wrapper>
          <ValueStrippedString>
            <AnnotatedValue
              value={value}
              meta={meta}
              withAnnotatedText={withAnnotatedText}
              withOnlyFormattedText={withOnlyFormattedText}
            />
          </ValueStrippedString>
        </Wrapper>
      );
    }

    if (containsCRLF(value)) {
      return (
        <Wrapper>
          <ValueMultiLineString data-test-id="value-multiline-string">
            <AnnotatedValue
              value={value}
              meta={meta}
              withAnnotatedText={withAnnotatedText}
              withOnlyFormattedText={withOnlyFormattedText}
            />
          </ValueMultiLineString>
        </Wrapper>
      );
    }

    return (
      <Wrapper>
        <span data-test-id="value-unformatted">
          <AnnotatedValue
            value={value}
            meta={meta}
            withAnnotatedText={withAnnotatedText}
            withOnlyFormattedText={withOnlyFormattedText}
          />
          <LinkHint meta={meta} value={value} />
        </span>
      </Wrapper>
    );
  }

  const children: React.ReactNode[] = [];

  if (Array.isArray(value)) {
    for (i = 0; i < value.length; i++) {
      children.push(
        <div key={i}>
          <RecursiveStructuredData
            config={config}
            meta={meta?.[i]}
            path={path + '.' + i}
            value={value[i]}
            withAnnotatedText={withAnnotatedText}
          />
          {i < value.length - 1 ? <span>{','}</span> : null}
        </div>
      );
    }
    return (
      <CollapsibleValue closeTag="]" openTag="[" path={path} prefix={formattedObjectKey}>
        {children}
      </CollapsibleValue>
    );
  }

  if (isValidElement(value)) {
    return value;
  }

  const keys = Object.keys(value);
  keys.sort(naturalCaseInsensitiveSort);
  for (i = 0; i < keys.length; i++) {
    const key = keys[i]!;

    children.push(
      <div key={key}>
        <RecursiveStructuredData
          config={config}
          meta={meta?.[key]!}
          objectKey={key}
          path={path + '.' + key}
          value={value[key]!}
          withAnnotatedText={withAnnotatedText}
        />
        {i < keys.length - 1 ? <span>{','}</span> : null}
      </div>
    );
  }

  return (
    <CollapsibleValue closeTag="}" openTag="{" path={path} prefix={formattedObjectKey}>
      {children}
    </CollapsibleValue>
  );
}

const ValueNull = styled('span')`
  font-weight: ${p => p.theme.fontWeightBold};
  color: var(--prism-property);
`;

const ValueBoolean = styled('span')`
  font-weight: ${p => p.theme.fontWeightBold};
  color: var(--prism-property);
`;

const ValueString = styled('span')`
  color: var(--prism-selector);
`;

/**
 * Multi-line strings have preformatted text that includes newlines.
 * We use a <pre> tag to preserve the newlines.
 */
const ValueMultiLineString = styled('pre')`
  display: block;
  overflow: auto;
  border-radius: 4px;
  padding: 2px 4px;
  background-color: transparent;
  color: ${p => p.theme.textColor};
`;

const ValueStrippedString = styled('span')`
  font-weight: ${p => p.theme.fontWeightBold};
  color: var(--prism-keyword);
`;

const ValueNumber = styled('span')`
  color: var(--prism-property);
`;

const ValueObjectKey = styled('span')`
  color: var(--prism-keyword);
`;
