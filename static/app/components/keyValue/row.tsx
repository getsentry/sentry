import {createContext, Fragment, isValidElement, useContext} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {AnnotatedTextErrors} from 'sentry/components/events/meta/annotatedText/annotatedTextErrors';
import {StructuredData, StructuredEventData} from 'sentry/components/structuredEventData';
import type {KeyValueListDataItem, MetaError} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';

export type KeyValueKeyColumn = 'equal' | 'fit' | 'wide';

export type KeyValueLayout = 'detail' | 'list';

export type KeyValueStatus = 'error' | 'warning';

export type KeyValueValueDisplay = 'expandable' | 'formatted' | 'raw';

/**
 * `subjectNode` overrides `subject`; passing `null` lets the value span the whole row.
 */
export interface KeyValueEntry extends Omit<KeyValueListDataItem, 'meta' | 'subject'> {
  disableLink?: boolean;
  /**
   * Rendered after the value, and marks the row as an error unless `status` says
   * otherwise.
   */
  errors?: MetaError[];
  /**
   * Annotations such as redactions and filters applied to the value.
   */
  meta?: Record<string, any>;
  /**
   * Tints the row to convey severity.
   */
  status?: KeyValueStatus;
  /**
   * The displayed label. Defaults to `key`.
   */
  subject?: string;
  /**
   * Overrides the list-wide `valueDisplay` for this entry.
   */
  valueDisplay?: KeyValueValueDisplay;
}

/**
 * Lets `KeyValue.Row` children inherit presentation from the list they are composed into,
 * so a compositional list styles its rows the same way a data-driven one does.
 */
export const KeyValueRowContext = createContext<{
  layout: KeyValueLayout;
  valueDisplay: KeyValueValueDisplay;
}>({layout: 'detail', valueDisplay: 'formatted'});

type KeyValueRowProps = React.HTMLAttributes<HTMLDivElement> & {
  layout?: KeyValueLayout;
  valueDisplay?: KeyValueValueDisplay;
} & (
    | {entry: KeyValueEntry; keyName?: never; status?: never; value?: never}
    | {
        keyName: React.ReactNode;
        value: React.ReactNode;
        entry?: never;
        status?: KeyValueStatus;
      }
  );

/**
 * A single row, either from an `entry` or from a `keyName`/`value` pair. Rendering one
 * outside a `KeyValue` requires a two-column grid parent, since rows inherit their
 * columns via `subgrid`.
 */
export function KeyValueRow({
  entry: entryProp,
  keyName,
  layout,
  status: statusProp,
  value,
  valueDisplay,
  ...props
}: KeyValueRowProps) {
  const defaults = useContext(KeyValueRowContext);
  const resolvedLayout = layout ?? defaults.layout;
  const entry = entryProp ?? {key: '', status: statusProp, subjectNode: keyName, value};
  const status = entry.status ?? (entry.errors?.length ? 'error' : undefined);
  const hasSuffix = Boolean(entry.errors?.length || entry.actionButton);

  return (
    <RevealOnHover>
      {({className}) => (
        <Row
          {...props}
          className={[props.className, className].filter(Boolean).join(' ')}
          status={status}
        >
          {entry.subjectNode !== null && (
            <KeyValueTerm layout={resolvedLayout} status={status}>
              {entry.subjectNode === undefined
                ? (entry.subject ?? entry.key)
                : entry.subjectNode}
            </KeyValueTerm>
          )}
          <KeyValueDefinition
            data-test-id={entry.subjectDataTestId}
            fullWidth={entry.subjectNode === null}
            hasSuffix={hasSuffix}
            layout={resolvedLayout}
            status={status}
          >
            <KeyValueValue
              entry={entry}
              valueDisplay={valueDisplay ?? defaults.valueDisplay}
            />
            {hasSuffix && <KeyValueSuffix entry={entry} />}
          </KeyValueDefinition>
        </Row>
      )}
    </RevealOnHover>
  );
}

function KeyValueValue({
  entry,
  valueDisplay,
}: {
  entry: KeyValueEntry;
  valueDisplay: KeyValueValueDisplay;
}) {
  const {action, disableLink, isMultiValue, meta, subjectIcon, value} = entry;
  const display =
    entry.valueDisplay ?? (entry.isContextData ? 'expandable' : valueDisplay);

  if (isMultiValue && Array.isArray(value)) {
    return (
      <Stack>
        {value.map((multiValue, index) => (
          <div key={index}>
            <ValueNode display={display} value={multiValue} />
          </div>
        ))}
      </Stack>
    );
  }

  const node = (
    <ValueNode display={display} meta={meta} subjectIcon={subjectIcon} value={value} />
  );

  if (disableLink || !defined(action?.link)) {
    return node;
  }

  return <ValueLink to={action.link}>{node}</ValueLink>;
}

function KeyValueSuffix({entry}: {entry: KeyValueEntry}) {
  const {actionButton, actionButtonAlwaysVisible, errors = []} = entry;

  return (
    <Flex align="start" gap="xs">
      {errors.length > 0 && <AnnotatedTextErrors errors={errors} />}
      {actionButton && (
        <RevealOnHover.Action visible={actionButtonAlwaysVisible}>
          {actionButton}
        </RevealOnHover.Action>
      )}
    </Flex>
  );
}

interface ValueNodeProps {
  display: KeyValueValueDisplay;
  value: KeyValueListDataItem['value'];
  meta?: Record<string, any>;
  subjectIcon?: React.ReactNode;
}

function ValueNode({display, meta, subjectIcon, value}: ValueNodeProps) {
  if (display === 'expandable') {
    return (
      <StructuredEventData data={value} meta={meta} withAnnotatedText>
        {subjectIcon}
      </StructuredEventData>
    );
  }

  if (display === 'formatted') {
    return (
      <StructuredData
        maxDefaultDepth={0}
        meta={meta}
        value={value}
        withAnnotatedText
        withOnlyFormattedText
      />
    );
  }

  if (isValidElement(value)) {
    return value;
  }

  return (
    <Fragment>
      <AnnotatedText
        meta={meta}
        value={
          typeof value === 'object' && value !== null
            ? JSON.stringify(value, null, 2)
            : value
        }
      />
      {subjectIcon}
    </Fragment>
  );
}

const STATUS_TONE = {error: 'danger', warning: 'warning'} as const;

function getStatusStyles(theme: Theme, status: KeyValueStatus | undefined) {
  if (!status) {
    return css`
      &:nth-of-type(odd) {
        background: ${theme.tokens.background.secondary};
      }
    `;
  }

  const tone = STATUS_TONE[status];
  const border = theme.tokens.border.transparent[tone].muted;

  return css`
    background: ${theme.tokens.background.transparent[tone].muted};
    box-shadow: inset 0 0 0 1px ${border};
  `;
}

function getStatusContent(theme: Theme, status: KeyValueStatus | undefined) {
  return status ? theme.tokens.content[STATUS_TONE[status]] : undefined;
}

function getColumns(layout: KeyValueLayout, keyColumn: KeyValueKeyColumn) {
  if (keyColumn === 'equal') {
    return layout === 'detail' ? 'fit-content(50%) 1fr' : '1fr 1fr';
  }

  return keyColumn === 'fit' ? 'min-content auto' : '2fr 1fr';
}

function getCellStyles(theme: Theme, layout: KeyValueLayout) {
  if (layout === 'detail') {
    return css`
      font-family: ${theme.font.family.mono};
      font-size: ${theme.font.size.sm};
      padding: ${theme.space['2xs']} ${theme.space.sm};
      word-break: break-word;
    `;
  }

  return css`
    font-family: ${theme.font.family.sans};
    font-size: ${theme.font.size.md};
    overflow: hidden;
    padding: ${theme.space.xs} ${theme.space.md};
    text-overflow: ellipsis;
    white-space: nowrap;
  `;
}

export const DefinitionList = styled('dl')<{
  keyColumn: KeyValueKeyColumn;
  layout: KeyValueLayout;
}>`
  column-gap: ${p => p.theme.space.lg};
  display: grid;
  grid-template-columns: ${p => getColumns(p.layout, p.keyColumn)};
  margin: 0;
`;

const Row = styled('div')<{status: KeyValueStatus | undefined}>`
  border-radius: ${p => p.theme.radius.xs};
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;

  ${p => getStatusStyles(p.theme, p.status)}
`;

export const KeyValueTerm = styled('dt')<{
  layout: KeyValueLayout;
  status: KeyValueStatus | undefined;
}>`
  ${p => getCellStyles(p.theme, p.layout)};
  align-items: center;
  color: ${p => getStatusContent(p.theme, p.status) ?? p.theme.tokens.content.primary};
  display: flex;
  font-weight: ${p => p.theme.font.weight.sans.regular};
  min-width: 0;
`;

export const KeyValueDefinition = styled('dd')<{
  fullWidth: boolean;
  hasSuffix: boolean;
  layout: KeyValueLayout;
  status: KeyValueStatus | undefined;
}>`
  ${p => getCellStyles(p.theme, p.layout)};
  color: ${p => getStatusContent(p.theme, p.status) ?? p.theme.tokens.content.secondary};
  grid-column: ${p => (p.fullWidth ? '1 / -1' : 'span 1')};
  margin: 0;
  min-width: 0;

  ${p =>
    p.hasSuffix &&
    css`
      align-items: start;
      display: grid;
      gap: ${p.theme.space.xs};
      grid-template-columns: 1fr auto;
    `}

  ${p =>
    p.layout === 'list' &&
    css`
      text-align: right;
    `}
`;

const ValueLink = styled(Link)`
  text-decoration: ${p => p.theme.tokens.interactive.link.accent.rest} underline dotted;
`;
