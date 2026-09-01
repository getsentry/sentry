import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {AnnotatedTextErrors} from 'sentry/components/events/meta/annotatedText/annotatedTextErrors';
import type {KeyValueListDataItem, MetaError} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';

import {useKeyValueTableContext} from './context';
import {PreformattedValue, Value, ValueLink} from './value';

export interface KeyValueDataContentProps {
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

export function Content({
  item,
  meta,
  errors = [],
  disableLink = false,
  disableFormattedData = false,
  isSuspectFlag = false,
  expandLeft,
  ...props
}: KeyValueDataContentProps) {
  const context = useKeyValueTableContext();
  const {
    subject,
    subjectNode,
    subjectIcon,
    subjectDataTestId,
    value: itemValue,
    action = {},
    actionButton,
    actionButtonAlwaysVisible,
    isContextData,
    isMultiValue,
  } = item;

  const isList = context.variant === 'list';
  const hasErrors = errors.length > 0;
  const hasSuffix = !!(hasErrors || actionButton);

  const valueProps = {
    value: itemValue,
    meta,
    subjectIcon,
    isContextData: isContextData || context.isContextData,
    raw: context.raw,
    disableFormattedData,
  };

  const dataComponent = isList ? (
    <PreformattedValue {...valueProps} />
  ) : (
    <Value {...valueProps} />
  );

  const linkedValue =
    !disableLink && defined(action?.link) ? (
      <ValueLink to={action.link}>{dataComponent}</ValueLink>
    ) : (
      dataComponent
    );

  const value =
    isList && isMultiValue && Array.isArray(itemValue) ? (
      <MultiValue values={itemValue} />
    ) : (
      linkedValue
    );

  if (isList) {
    return (
      <tr>
        <td className="key">{subject}</td>
        <td className="val" data-test-id={subjectDataTestId}>
          <ListValue>
            {actionButton ? (
              <ListValueWithButton>
                {value}
                <Flex align="start" height="100%">
                  {actionButton}
                </Flex>
              </ListValueWithButton>
            ) : (
              value
            )}
          </ListValue>
        </td>
      </tr>
    );
  }

  return (
    <RowWrapper
      expandLeft={expandLeft}
      hasErrors={hasErrors}
      isSuspectFlag={isSuspectFlag}
      {...props}
    >
      {subjectNode === undefined ? <Subject>{subject}</Subject> : subjectNode}
      <ValueSection hasErrors={hasErrors} hasEmptySubject={subjectNode === null}>
        <ValueWrapper hasSuffix={hasSuffix}>{value}</ValueWrapper>
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
      </ValueSection>
    </RowWrapper>
  );
}

function MultiValue({values}: {values: readonly React.ReactNode[]}) {
  return values.map((value, index) => <PreformattedValue key={index} value={value} />);
}

const RowWrapper = styled('div')<{
  hasErrors: boolean;
  isSuspectFlag: boolean;
  expandLeft?: boolean;
}>`
  display: grid;
  grid-template-columns: ${p => (p.expandLeft ? '2fr 0.8fr' : 'subgrid')};
  grid-column: span 2;
  column-gap: ${p => p.theme.space.lg};
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.sm};
  border-radius: 4px;
  color: ${p =>
    p.hasErrors
      ? p.theme.colors.red500
      : p.isSuspectFlag
        ? p.theme.colors.yellow500
        : p.theme.tokens.content.secondary};
  box-shadow: inset 0 0 0 1px
    ${p =>
      p.hasErrors
        ? p.theme.colors.red100
        : p.isSuspectFlag
          ? p.theme.colors.yellow100
          : 'transparent'};
  background-color: ${p =>
    p.hasErrors
      ? p.theme.colors.red100
      : p.isSuspectFlag
        ? p.theme.colors.yellow100
        : p.theme.tokens.background.primary};
  &:nth-child(odd) {
    background-color: ${p =>
      p.hasErrors
        ? p.theme.colors.red100
        : p.isSuspectFlag
          ? p.theme.colors.yellow100
          : p.theme.tokens.background.secondary};
  }

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

export const Subject = styled('div')`
  grid-column: span 1;
  font-family: ${p => p.theme.font.family.mono};
  word-break: break-word;
  min-width: 100px;
`;

export const ValueSection = styled('div')<{
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

const ListValue = styled('div')`
  pre {
    && {
      word-break: break-all;
    }
  }
  pre > pre {
    display: inline-block;
  }
`;

const ListValueWithButton = styled('div')`
  display: grid;
  align-items: center;
  gap: ${p => p.theme.space.md};
  font-size: ${p => p.theme.font.size.sm};
  background: ${p => p.theme.tokens.background.secondary};
  padding: ${p => p.theme.space.md} 10px;
  margin: ${p => p.theme.space['2xs']} 0;
  border-radius: ${p => p.theme.radius.md};
  pre {
    padding: 0 !important;
    margin: 0 !important;
  }

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr max-content;
  }
`;
