import {Fragment, isValidElement, useCallback} from 'react';
import styled from '@emotion/styled';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import AnnotatedValue from 'sentry/components/structuredEventData/annotatedValue';
import {CollapsibleValue} from 'sentry/components/structuredEventData/collapsibleValue';
import LinkHint from 'sentry/components/structuredEventData/linkHint';
import {ExpandedStateContextProvider} from 'sentry/components/structuredEventData/useExpandedState';
import {
  getDefaultExpanded,
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

interface BaseProps {
  /**
   * Allows customization of how values are rendered
   */
  config?: StructedEventDataConfig;

  /**
   * Enables auto-expansion of items on initial render.
   */
  forceDefaultExpand?: boolean;

  /**
   * Array of the paths to expand, can be arbitrarily deep. Only takes effect on
   * mount.
   *
   * Overrides `forceDefaultExpand` and `maxDefaultDepth`.
   *
   * paths is a "." concatenated list of array-indexes and object-keys starting
   * from '$' as the root.
   * example: "$.users.0" would expand  `{users: [{name: 'cramer'}]}`
   */
  initialExpandedPaths?: string[];

  /**
   * Set the max depth to expand items. Default: 2
   *
   * Only items with 5 or fewer children can be auto-expanded.
   *
   * Only takes affect when `forceDefaultExpand` is `true` or `undefined`
   */
  maxDefaultDepth?: number;

  meta?: Record<any, any>;

  /**
   * A callback to keep track of expanded items.
   *
   * Pass this into `initialExpandedPaths` to re-render a previous expanded state
   */
  onToggleExpand?: (
    path: string,
    expandedPaths: string[],
    state: 'expanded' | 'collapsed'
  ) => void;
}

export interface StructuredEventDataProps extends BaseProps {
  children?: React.ReactNode;
  className?: string;
  // TODO(TS): What possible types can `data` be?
  data?: any;
  'data-test-id'?: string;
  onCopy?: (copiedCode: string) => void;
  showCopyButton?: boolean;
  withAnnotatedText?: boolean;
}

interface StrucutedDataProps extends BaseProps {
  maxDefaultDepth: NonNullable<BaseProps['maxDefaultDepth']>;
  withAnnotatedText: boolean;
  objectKey?: string;
  // TODO(TS): What possible types can `value` be?
  value?: any;
  withOnlyFormattedText?: boolean;
}

export function StructuredData({
  config,
  forceDefaultExpand,
  initialExpandedPaths,
  maxDefaultDepth,
  meta,
  objectKey,
  onToggleExpand,
  value = null,
  withAnnotatedText,
  withOnlyFormattedText = false,
}: StrucutedDataProps) {
  const getInitialExpandedPaths = useCallback(() => {
    return (
      initialExpandedPaths ??
      (forceDefaultExpand === false ||
      (forceDefaultExpand === undefined && !maxDefaultDepth)
        ? []
        : getDefaultExpanded(Math.max(1, maxDefaultDepth), value))
    );

    // No need to update if expand/collapse props changes, we're not going to
    // re-render based on those.
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ExpandedStateContextProvider
      initialExpandedPaths={getInitialExpandedPaths}
      onToggleExpand={onToggleExpand}
    >
      <RecursiveStructuredData
        config={config}
        meta={meta}
        objectKey={objectKey}
        path="$"
        value={value}
        withAnnotatedText={withAnnotatedText}
        withOnlyFormattedText={withOnlyFormattedText}
      />
    </ExpandedStateContextProvider>
  );
}
function RecursiveStructuredData({
  config,
  meta,
  objectKey,
  path,
  value = null,
  withAnnotatedText,
  withOnlyFormattedText = false,
}: {
  meta: Record<any, any> | undefined;
  path: string;
  withAnnotatedText: boolean;
  config?: StructedEventDataConfig;
  objectKey?: string;
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
    const key = keys[i];

    children.push(
      <div key={key}>
        <RecursiveStructuredData
          config={config}
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
    <CollapsibleValue closeTag="}" openTag="{" path={path} prefix={formattedObjectKey}>
      {children}
    </CollapsibleValue>
  );
}

export default function StructuredEventData({
  children,
  config,
  data = null,
  forceDefaultExpand,
  initialExpandedPaths,
  maxDefaultDepth = 2,
  meta,
  onCopy,
  onToggleExpand,
  showCopyButton,
  withAnnotatedText = false,
  ...props
}: StructuredEventDataProps) {
  return (
    <StructuredDataWrapper {...props}>
      <StructuredData
        config={config}
        forceDefaultExpand={forceDefaultExpand}
        initialExpandedPaths={initialExpandedPaths}
        maxDefaultDepth={maxDefaultDepth}
        meta={meta}
        onToggleExpand={onToggleExpand}
        value={data}
        withAnnotatedText={withAnnotatedText}
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
