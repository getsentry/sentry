import styled from '@emotion/styled';

import {RevealOnHover} from '@sentry/scraps/revealOnHover';

import {AnnotatedTextErrors} from 'sentry/components/events/meta/annotatedText/annotatedTextErrors';
import type {KeyValueListDataItem, MetaError} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';

import {KeyValueRow, type KeyValueTableVariant} from './keyValueRow';
import {Value, ValueLink} from './value';

export interface KeyValueTableDataRowProps {
  /**
   * Specifies the item to display.
   * - If set, item.subjectNode will override displaying item.subject.
   * - If item.subjectNode is null, the value section will span the whole card.
   * - If item.action.link is specified, the value will appear as a link.
   * - If item.actionButton is specified, the button will be rendered inline with the value.
   */
  item: KeyValueListDataItem;
  /**
   * If enabled, renders raw value instead of formatted structured data
   */
  disableFormattedData?: boolean;
  /**
   * If enabled, avoids rendering links, even if provided via `item.action.link`.
   */
  disableLink?: boolean;
  /**
   * Errors pertaining to content item
   */
  errors?: MetaError[];
  /**
   * Used for the feature flag section.
   * If true, then the row will be highlighted in yellow.
   */
  isSuspectFlag?: boolean;
  /**
   * Metadata pertaining to content item
   */
  meta?: Record<string, any>;
  /**
   * Subject column typography and row padding. Defaults to `code`.
   */
  variant?: KeyValueTableVariant;
}

export function KeyValueTableDataRow({
  item,
  meta,
  errors = [],
  disableLink = false,
  disableFormattedData = false,
  isSuspectFlag = false,
  variant = 'code',
  ...props
}: KeyValueTableDataRowProps) {
  const {
    subject,
    subjectNode,
    value: itemValue,
    action = {},
    actionButton,
    actionButtonAlwaysVisible,
    subjectDataTestId,
  } = item;

  const hasErrors = errors.length > 0;
  const hasSuffix = !!(hasErrors || actionButton);

  const dataComponent = (
    <Value value={itemValue} meta={meta} disableFormattedData={disableFormattedData} />
  );

  return (
    <KeyValueRow
      tone={hasErrors ? 'danger' : isSuspectFlag ? 'warning' : undefined}
      variant={variant}
      {...props}
    >
      {subjectNode !== null && (
        <KeyValueTableSubject variant={variant}>
          {subjectNode ?? subject}
        </KeyValueTableSubject>
      )}
      <KeyValueTableValueSection
        data-test-id={subjectDataTestId}
        hasErrors={hasErrors}
        hasEmptySubject={subjectNode === null}
      >
        <ValueWrapper hasSuffix={hasSuffix}>
          {!disableLink && defined(action?.link) ? (
            <ValueLink to={action.link}>{dataComponent}</ValueLink>
          ) : (
            dataComponent
          )}
        </ValueWrapper>
        {hasSuffix && (
          <div>
            {hasErrors && <AnnotatedTextErrors errors={errors} />}
            {actionButton && (
              <ActionButtonWrapper>
                {actionButtonAlwaysVisible ? (
                  actionButton
                ) : (
                  <RevealOnHover.Action>{actionButton}</RevealOnHover.Action>
                )}
              </ActionButtonWrapper>
            )}
          </div>
        )}
      </KeyValueTableValueSection>
    </KeyValueRow>
  );
}

const KeyValueTableSubject = styled('div')<{variant?: KeyValueTableVariant}>`
  grid-column: span 1;
  font-family: ${p =>
    p.variant === 'label' ? p.theme.font.family.sans : p.theme.font.family.mono};
  font-weight: ${p =>
    p.variant === 'label' ? p.theme.font.weight.sans.medium : 'inherit'};
  color: ${p => (p.variant === 'label' ? p.theme.tokens.content.primary : 'inherit')};
  word-break: break-word;
  min-width: 100px;
`;

const KeyValueTableValueSection = styled('div')<{
  hasEmptySubject: boolean;
  hasErrors: boolean;
}>`
  font-family: ${p => p.theme.font.family.mono};
  word-break: break-word;
  color: ${p => (p.hasErrors ? 'inherit' : p.theme.tokens.content.primary)};
  grid-column: ${p => (p.hasEmptySubject ? '1 / -1' : 'span 1')};
  display: grid;
  grid-template-columns: 1fr auto;
  grid-column-gap: ${p => p.theme.space.xs};
`;

const ValueWrapper = styled('div')<{hasSuffix: boolean}>`
  word-break: break-word;
  grid-column: ${p => (p.hasSuffix ? 'span 1' : '1 / -1')};
  min-width: 0;
  max-width: 100%;
`;

const ActionButtonWrapper = styled('div')`
  font-family: ${p => p.theme.font.family.sans};
  /* Cancels KeyValueRow's vertical padding so a button doesn't grow the row past its own height */
  margin-block: calc(-1 * ${p => p.theme.space['2xs']});
`;
