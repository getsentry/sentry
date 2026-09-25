import {Fragment} from 'react';

import {InfoText} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';

import {IconInfo, IconSentry} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  FieldValueType,
  getFieldDefinition,
  type GetFieldDefinitionType,
} from 'sentry/utils/fields';

export interface AttributeDetailsTooltipProps {
  /**
   * The attribute's canonical key, as the field definition registry names it.
   */
  attributeKey: string;
  /**
   * The text rendered inline, when only part of the name belongs there, e.g. one
   * segment of a key the surrounding table already nests.
   */
  children?: React.ReactNode;
  /**
   * The type shown when no field definition supplies one. A definition types an
   * attribute more precisely than its storage does, so it is never overridden.
   */
  defaultValueType?: FieldValueType;
  /**
   * The registry `attributeKey` is looked up in. An attribute found there is one
   * Sentry defines, so the tooltip credits Sentry for it.
   */
  fieldDefinitionType?: GetFieldDefinitionType;
  isScrubbed?: boolean;
  /**
   * What the attribute is called, when that reads better than its canonical key,
   * e.g. with a `sentry.` prefix or a `tags[…]` wrapper taken off.
   */
  name?: string;
  position?: TooltipProps['position'];
}

/**
 * Renders an attribute's name as the hover target for its details, so the
 * underline marks the name as something to hover rather than just text.
 */
export function AttributeDetailsTooltip({
  attributeKey,
  defaultValueType,
  fieldDefinitionType,
  children,
  isScrubbed,
  name,
  position,
}: AttributeDetailsTooltipProps) {
  const fieldDefinition = getFieldDefinition(attributeKey, fieldDefinitionType);
  const valueType =
    fieldDefinition?.valueType ?? defaultValueType ?? FieldValueType.STRING;
  const description = fieldDefinition?.desc ?? t('A tag sent with one or more events');
  const attributeName = name ?? attributeKey;

  return (
    <InfoText
      variant="muted"
      position={position}
      title={
        <Fragment>
          <Tooltip.Grid gap="md">
            <Stack gap="2xs" align="start">
              <Text bold wordBreak="break-word">
                {attributeName}
              </Text>
              <Text variant="accent">{valueType}</Text>
            </Stack>
            {isScrubbed ? (
              <Flex align="center" gap="xs">
                <IconInfo size="xs" />
                <Text>{t('Data scrubbed for privacy')}</Text>
              </Flex>
            ) : null}
            <Stack gap="2xs" align="start">
              <Text variant="muted">{t('Description')}</Text>
              <Text>{description}</Text>
            </Stack>
          </Tooltip.Grid>
          {fieldDefinition ? (
            <Tooltip.Footer leadingItems={<IconSentry size="xs" />}>
              {t('Added by Sentry')}
            </Tooltip.Footer>
          ) : null}
        </Fragment>
      }
    >
      {children ?? attributeName}
    </InfoText>
  );
}
