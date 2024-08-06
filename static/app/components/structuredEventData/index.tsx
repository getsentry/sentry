import {useCallback} from 'react';
import styled from '@emotion/styled';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {RecursiveStructuredData} from 'sentry/components/structuredEventData/recursiveStructuredData';
import {ExpandedStateContextProvider} from 'sentry/components/structuredEventData/useExpandedState';
import {getDefaultExpanded} from 'sentry/components/structuredEventData/utils';
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
   * Set the limit which when exceeded, causes child items to collapse into a button. Default: 5
   *
   * Only takes affect when `forceDefaultExpand` is `true` or `undefined`
   */
  autoCollapseLimit?: number;

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
   * Only items with fewer children than the `autoCollapseLimit` (Default: 5)  can be auto-expanded.
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
    expandedPaths: string[],
    path: string,
    state: 'expanded' | 'collapsed'
  ) => void;
}

interface StructuredDataProps extends BaseProps {
  maxDefaultDepth: NonNullable<BaseProps['maxDefaultDepth']>;
  withAnnotatedText: boolean;
  autoCollapseLimit?: BaseProps['autoCollapseLimit'];
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
  autoCollapseLimit,
  meta,
  objectKey,
  onToggleExpand,
  value = null,
  withAnnotatedText,
  withOnlyFormattedText = false,
}: StructuredDataProps) {
  const getInitialExpandedPaths = useCallback(() => {
    return (
      initialExpandedPaths ??
      (forceDefaultExpand === false ||
      (forceDefaultExpand === undefined && !maxDefaultDepth)
        ? []
        : getDefaultExpanded(Math.max(1, maxDefaultDepth), value, autoCollapseLimit))
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

export default function StructuredEventData({
  children,
  config,
  data = null,
  forceDefaultExpand,
  initialExpandedPaths,
  maxDefaultDepth = 2,
  autoCollapseLimit,
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
        autoCollapseLimit={autoCollapseLimit}
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

const StyledCopyButton = styled(CopyToClipboardButton)`
  position: absolute;
  right: ${space(1.5)};
  top: ${space(0.75)};
`;

const StructuredDataWrapper = styled('pre')`
  position: relative;
`;
