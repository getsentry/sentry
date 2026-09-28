import {Fragment} from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconInfo, IconSentry} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {FieldKind, FieldValueType} from 'sentry/utils/fields';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';

export interface AttributeDetailsProps {
  name: React.ReactNode;
  description?: React.ReactNode;
  isAddedBySentry?: boolean;
  isScrubbed?: boolean;
  kind?: FieldKind;
  valueType?: FieldValueType;
}

/**
 * Returns the sections bare rather than in a wrapping box, so that a tooltip
 * can pull them back out to its own edges.
 */
export function AttributeDetails({
  description,
  isAddedBySentry,
  isScrubbed,
  kind,
  name,
  valueType,
}: AttributeDetailsProps) {
  return (
    <Fragment>
      <Tooltip.Grid gap="md">
        <Stack gap="2xs">
          <Text bold wordBreak="break-word">
            {name}
          </Text>
          <TypeBadge kind={kind} valueType={valueType} />
        </Stack>
        {isScrubbed ? (
          <Flex align="center" gap="xs">
            <IconInfo size="xs" />
            <Text>{t('Data scrubbed for privacy')}</Text>
          </Flex>
        ) : null}
        {description ? (
          <Stack gap="2xs">
            <Text variant="muted">{t('Description')}</Text>
            <Text>{description}</Text>
          </Stack>
        ) : null}
      </Tooltip.Grid>
      {isAddedBySentry ? (
        <Tooltip.Footer leadingItems={<IconSentry size="xs" />}>
          {t('Added by Sentry')}
        </Tooltip.Footer>
      ) : null}
    </Fragment>
  );
}
