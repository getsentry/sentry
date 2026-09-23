import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {AnnotatedTextErrors} from 'sentry/components/events/meta/annotatedText/annotatedTextErrors';
import type {KeyValueListDataItem, MetaError} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';

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
   * If true, expands the left side of the cards to take up more space.
   */
  expandLeft?: boolean;
  /**
   * Used for the feature flag section.
   * If true, then the row will be highlighted in yellow.
   */
  isSuspectFlag?: boolean;
  /**
   * Metadata pertaining to content item
   */
  meta?: Record<string, any>;
}

export function KeyValueTableDataRow({
  item,
  meta,
  errors = [],
  disableLink = false,
  disableFormattedData = false,
  isSuspectFlag = false,
  expandLeft,
  ...props
}: KeyValueTableDataRowProps) {
  const {
    subject,
    subjectNode,
    value: itemValue,
    action = {},
    actionButton,
    actionButtonAlwaysVisible,
  } = item;

  const hasErrors = errors.length > 0;
  const hasSuffix = !!(hasErrors || actionButton);

  const dataComponent = (
    <Value value={itemValue} meta={meta} disableFormattedData={disableFormattedData} />
  );

  return (
    <RowWrapper
      expandLeft={expandLeft}
      hasErrors={hasErrors}
      isSuspectFlag={isSuspectFlag}
      {...props}
    >
      {subjectNode === undefined ? (
        <KeyValueTableSubject>{subject}</KeyValueTableSubject>
      ) : (
        subjectNode
      )}
      <KeyValueTableValueSection
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
              <ActionButtonWrapper actionButtonAlwaysVisible={actionButtonAlwaysVisible}>
                {actionButton}
              </ActionButtonWrapper>
            )}
          </div>
        )}
      </KeyValueTableValueSection>
    </RowWrapper>
  );
}

type RowState = {hasErrors: boolean; isSuspectFlag: boolean};

const rowStateStyles = ({theme, hasErrors, isSuspectFlag}: RowState & {theme: Theme}) => {
  const [content, tint] = hasErrors
    ? [theme.colors.red500, theme.colors.red100]
    : isSuspectFlag
      ? [theme.colors.yellow500, theme.colors.yellow100]
      : [theme.tokens.content.secondary, null];

  return css`
    color: ${content};
    box-shadow: inset 0 0 0 1px ${tint ?? 'transparent'};
    background-color: ${tint ?? theme.tokens.background.primary};
    &:nth-child(odd) {
      background-color: ${tint ?? theme.tokens.background.secondary};
    }
  `;
};

const RowWrapper = styled('div')<RowState & {expandLeft?: boolean}>`
  display: grid;
  grid-template-columns: ${p => (p.expandLeft ? '2fr 0.8fr' : 'subgrid')};
  grid-column: span 2;
  column-gap: ${p => p.theme.space.lg};
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.sm};
  border-radius: 4px;
  ${rowStateStyles};

  .invisible {
    visibility: hidden;
  }
  &:hover,
  &:active {
    .invisible {
      visibility: visible;
    }
  }
`;

export const KeyValueTableSubject = styled('div')`
  grid-column: span 1;
  font-family: ${p => p.theme.font.family.mono};
  word-break: break-word;
  min-width: 100px;
`;

export const KeyValueTableValueSection = styled('div')<{
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

const ActionButtonWrapper = styled('div')<{actionButtonAlwaysVisible?: boolean}>`
  ${p =>
    !p.actionButtonAlwaysVisible &&
    css`
      visibility: hidden;
      ${RowWrapper}:hover & {
        visibility: visible;
      }
    `}
`;
