import {Fragment, isValidElement} from 'react';
import styled from '@emotion/styled';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import ExternalLink from 'sentry/components/links/externalLink';
import {CollapsibleValue} from 'sentry/components/structuredEventData/collapsibleValue';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {isUrl} from 'sentry/utils';

import {
  looksLikeMultiLineString,
  looksLikeStrippedValue,
  naturalCaseInsensitiveSort,
} from './utils';

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
  maxDefaultDepth?: number;
  meta?: Record<any, any>;
  withAnnotatedText?: boolean;
};

function AnnotatedValue({
  value,
  withAnnotatedText,
  meta,
}: {
  meta: Record<any, any> | undefined;
  withAnnotatedText: boolean;
  value?: React.ReactNode;
}) {
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

function StructuredData({
  config,
  depth,
  value = null,
  maxDefaultDepth,
  withAnnotatedText,
  meta,
  objectKey,
}: {
  config: StructedEventDataConfig | undefined;
  depth: number;
  maxDefaultDepth: number;
  meta: Record<any, any> | undefined;
  withAnnotatedText: boolean;
  objectKey?: string;
  // TODO(TS): What possible types can `value` be?
  value?: any;
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
            />
            {'"'}
            <LinkHint value={stringValue} />
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
            />
          </ValueStrippedString>
        </Wrapper>
      );
    }

    if (looksLikeMultiLineString(value)) {
      <Wrapper>
        <ValueMultiLineString>
          <AnnotatedValue
            value={value}
            meta={meta}
            withAnnotatedText={withAnnotatedText}
          />
        </ValueMultiLineString>
      </Wrapper>;
    }

    return (
      <Wrapper>
        <span data-test-id="value-unformatted">
          <AnnotatedValue
            value={value}
            meta={meta}
            withAnnotatedText={withAnnotatedText}
          />
          <LinkHint value={value} />
        </span>
      </Wrapper>
    );
  }

  const children: React.ReactNode[] = [];

  if (Array.isArray(value)) {
    for (i = 0; i < value.length; i++) {
      children.push(
        <div key={i}>
          <StructuredData
            config={config}
            value={value[i]}
            depth={depth + 1}
            withAnnotatedText={withAnnotatedText}
            meta={meta?.[i]}
            maxDefaultDepth={maxDefaultDepth}
          />
          {i < value.length - 1 ? <span>{','}</span> : null}
        </div>
      );
    }
    return (
      <CollapsibleValue
        openTag="["
        closeTag="]"
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
        <StructuredData
          config={config}
          value={value[key]}
          depth={depth + 1}
          withAnnotatedText={withAnnotatedText}
          meta={meta?.[key]}
          maxDefaultDepth={maxDefaultDepth}
          objectKey={key}
        />
        {i < keys.length - 1 ? <span>{','}</span> : null}
      </div>
    );
  }

  return (
    <CollapsibleValue
      openTag="{"
      closeTag="}"
      prefix={formattedObjectKey}
      maxDefaultDepth={maxDefaultDepth}
      depth={depth}
    >
      {children}
    </CollapsibleValue>
  );
}

function StructuredEventData({
  config,
  children,
  meta,
  maxDefaultDepth = 2,
  data = null,
  withAnnotatedText = false,
  ...props
}: StructuredEventDataProps) {
  return (
    <pre {...props}>
      <StructuredData
        config={config}
        value={data}
        depth={0}
        maxDefaultDepth={maxDefaultDepth}
        meta={meta}
        withAnnotatedText={withAnnotatedText}
      />
      {children}
    </pre>
  );
}

export default StructuredEventData;

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
  display: block;
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
