import {Fragment} from 'react';

import {InfoText} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconInfo, IconSentry} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  DEFAULT_TAG_DESCRIPTION,
  FieldValueType,
  getFieldDefinition,
  type GetFieldDefinitionType,
} from 'sentry/utils/fields';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';

export interface AttributeDetailsTooltipProps {
  /**
   * The attribute's canonical key, as the field definition registry names it.
   */
  attributeKey: string;
  /**
   * The registry `attributeKey` is looked up in. An attribute found there is one
   * Sentry defines, so the tooltip credits Sentry for it.
   */
  fieldDefinitionType: GetFieldDefinitionType;
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
  isScrubbed?: boolean;
  /**
   * What the attribute is called, when that reads better than its canonical key,
   * e.g. with a `sentry.` prefix or a `tags[…]` wrapper taken off.
   */
  name?: string;
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
}: AttributeDetailsTooltipProps) {
  const fieldDefinition = getFieldDefinition(attributeKey, fieldDefinitionType);
  const valueType =
    fieldDefinition?.valueType ?? defaultValueType ?? FieldValueType.STRING;
  const description = fieldDefinition?.desc ?? DEFAULT_TAG_DESCRIPTION;
  const attributeName = name ?? attributeKey;

  return (
    <InfoText
      variant="muted"
      title={
        <Fragment>
          <Tooltip.Grid gap="md">
            <Stack gap="2xs">
              <Text bold wordBreak="break-word">
                {attributeName}
              </Text>
              <TypeBadge valueType={valueType} />
            </Stack>
            {isScrubbed ? (
              <Flex align="center" gap="xs">
                <IconInfo size="xs" />
                <Text>{t('Data scrubbed for privacy')}</Text>
              </Flex>
            ) : null}
            <Stack gap="2xs">
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
