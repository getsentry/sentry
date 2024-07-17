import styled from '@emotion/styled';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {RecursiveStructuredData} from 'sentry/components/structuredEventData/recursiveStructuredData';
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

interface StructuredDataProps {
  maxDefaultDepth: number;
  withAnnotatedText: boolean;
  config?: StructedEventDataConfig;
  forceDefaultExpand?: boolean;
  meta?: Record<any, any>;
  objectKey?: string;
  // TODO(TS): What possible types can `value` be?
  value?: any;
  withOnlyFormattedText?: boolean;
}

export function StructuredData({
  config,
  value = null,
  maxDefaultDepth,
  withAnnotatedText,
  withOnlyFormattedText = false,
  meta,
  objectKey,
  forceDefaultExpand,
}: StructuredDataProps) {
  return (
    <RecursiveStructuredData
      config={config}
      depth={0}
      value={value}
      maxDefaultDepth={maxDefaultDepth}
      withAnnotatedText={withAnnotatedText}
      withOnlyFormattedText={withOnlyFormattedText}
      meta={meta}
      objectKey={objectKey}
      forceDefaultExpand={forceDefaultExpand}
    />
  );
}

export interface StructuredEventDataProps {
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
      <RecursiveStructuredData
        config={config}
        value={data}
        depth={0}
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

const StyledCopyButton = styled(CopyToClipboardButton)`
  position: absolute;
  right: ${space(1.5)};
  top: ${space(0.75)};
`;

const StructuredDataWrapper = styled('pre')`
  position: relative;
`;
