import {Fragment, isValidElement} from 'react';
import styled from '@emotion/styled';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import AnnotatedValue from 'sentry/components/structuredEventData/annotatedValue';
import {CollapsibleValue} from 'sentry/components/structuredEventData/collapsibleValue';
import LinkHint from 'sentry/components/structuredEventData/linkHint';
import {
  looksLikeMultiLineString,
  looksLikeStrippedValue,
  naturalCaseInsensitiveSort,
} from 'sentry/components/structuredEventData/utils';
import {space} from 'sentry/styles/space';

export type StructedEventDataConfig = {
  isBoolean?: (value: unknown) => boolean;
  isNull?: (value: unknown) => boolean;
  isNumber?: (value: unknown) => boolean;
  isString?: (value: unknown) => boolean;
  renderBoolean?: (value: unknown) => React.ReactNode;
  renderNull?: (value: unknown) => React.ReactNode;
  renderObjectKeys?: (value: string) => string;
  renderString?: (value: string) => string;
};

export type StructuredEventDataProps = {
  children?: React.ReactNode;
  className?: string;
  /**
   * Allows customization of how values are rendered
   */
  config?: StructedEventDataConfig;
  // TODO(TS): What possible types can `data` be?
  data?: any;
  'data-test-id'?: string;
  /**
   * Forces objects to default to expanded when rendered
   */
  forceDefaultExpand?: boolean;
  maxDefaultDepth?: number;
  meta?: Record<any, any>;
  onCopy?: (copiedCode: string) => void;
  showCopyButton?: boolean;
  withAnnotatedText?: boolean;
};

export function StructuredData({
  config,
  value = null,
  maxDefaultDepth,
  withAnnotatedText,
  withOnlyFormattedText = false,
  meta,
  objectKey,
  forceDefaultExpand,
}: {
  maxDefaultDepth: number;
  meta: Record<any, any> | undefined;
  withAnnotatedText: boolean;
  config?: StructedEventDataConfig;
  forceDefaultExpand?: boolean;
  objectKey?: string;
  showCopyButton?: boolean;
  // TODO(TS): What possible types can `value` be?
  value?: any;
  withOnlyFormattedText?: boolean;
}) {
  return (
    <RecursiveStructuredData
      config={config}
      depth={0}
      forceDefaultExpand={forceDefaultExpand}
      maxDefaultDepth={maxDefaultDepth}
      meta={meta}
      objectKey={objectKey}
      path="$"
      value={value}
      withAnnotatedText={withAnnotatedText}
      withOnlyFormattedText={withOnlyFormattedText}
    />
  );
}
function RecursiveStructuredData({
  config,
  depth,
  forceDefaultExpand,
  maxDefaultDepth,
  meta,
  objectKey,
  path,
  value = null,
  withAnnotatedText,
  withOnlyFormattedText = false,
}: {
  depth: number;
  maxDefaultDepth: number;
  meta: Record<any, any> | undefined;
  path: string;
  withAnnotatedText: boolean;
  config?: StructedEventDataConfig;
  forceDefaultExpand?: boolean;
  objectKey?: string;
  showCopyButton?: boolean;
  // TODO(TS): What possible types can `value` be?
  value?: any;
  withOnlyFormattedText?: boolean;
}) {
  let i = 0;

  const formattedObjectKey = objectKey ? (
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

    if (looksLikeMultiLineString(value)) {
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
            depth={depth + 1}
            maxDefaultDepth={maxDefaultDepth}
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
      <CollapsibleValue
        openTag="["
        closeTag="]"
        path={path}
        prefix={formattedObjectKey}
        maxDefaultDepth={maxDefaultDepth}
        depth={depth}
      >
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
    const key = keys[i];

    children.push(
      <div key={key}>
        <RecursiveStructuredData
          config={config}
          depth={depth + 1}
          maxDefaultDepth={maxDefaultDepth}
          meta={meta?.[key]}
          objectKey={key}
          path={path + '.' + key}
          value={value[key]}
          withAnnotatedText={withAnnotatedText}
        />
        {i < keys.length - 1 ? <span>{','}</span> : null}
      </div>
    );
  }

  return (
    <CollapsibleValue
      openTag="{"
      closeTag="}"
      path={path}
      prefix={formattedObjectKey}
      maxDefaultDepth={maxDefaultDepth}
      depth={depth}
      forceDefaultExpand={forceDefaultExpand}
    >
      {children}
    </CollapsibleValue>
  );
}

export default function StructuredEventData({
  config,
  children,
  meta,
  maxDefaultDepth = 2,
  data = null,
  withAnnotatedText = false,
  forceDefaultExpand,
  showCopyButton,
  onCopy,
  ...props
}: StructuredEventDataProps) {
  return (
    <StructuredDataWrapper {...props}>
      <StructuredData
        config={config}
        value={data}
        maxDefaultDepth={maxDefaultDepth}
        meta={meta}
        withAnnotatedText={withAnnotatedText}
        forceDefaultExpand={forceDefaultExpand}
      />
      {children}
      {showCopyButton && (
        <StyledCopyButton
          borderless
          iconSize="xs"
          onCopy={onCopy}
          size="xs"
          text={JSON.stringify(data, null, '\t')}
        />
      )}
    </StructuredDataWrapper>
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

const ValueMultiLineString = styled('span')`
  display: block;
  overflow: auto;
  border-radius: 4px;
  padding: 2px 4px;
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

const StyledCopyButton = styled(CopyToClipboardButton)`
  position: absolute;
  right: ${space(1.5)};
  top: ${space(0.75)};
`;

const StructuredDataWrapper = styled('pre')`
  position: relative;
`;
