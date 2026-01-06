import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button/button';
import {Input} from '@sentry/scraps/input/input';
import {Flex} from '@sentry/scraps/layout/flex';
import {Text} from '@sentry/scraps/text/text';

import type {BranchOverride} from 'sentry/components/events/autofix/types';
import {isOverrideValid} from 'sentry/components/events/autofix/utils/isOverrideValid';
import {overrideHasAnyValue} from 'sentry/components/events/autofix/utils/overrideHasAnyValue';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {IconClose} from 'sentry/icons/iconClose';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';

interface Props {
  canWrite: boolean;
  onRemoveOverride: () => void;
  onUpdateOverride: (updatedOverride: BranchOverride) => void;
  override: BranchOverride;
}

export default function AutofixRepositoriesItemBranchOverride({
  canWrite,
  onRemoveOverride,
  onUpdateOverride,
  override,
}: Props) {
  const theme = useTheme();
  const hasAnyValue = Boolean(overrideHasAnyValue(override));
  const isValid = isOverrideValid(override);

  const getErrorStyle = (value: string) =>
    hasAnyValue && !value.trim() ? {borderColor: theme.tokens.border.danger} : undefined;

  return (
    <Flex align="center" gap="sm">
      <Flex width="14px">
        <StatusIcon isValid={isValid} hasAnyValue={hasAnyValue} />
      </Flex>
      <Text wrap="nowrap">{t('When')}</Text>
      <Input
        disabled={!canWrite}
        onChange={e => onUpdateOverride({...override, tag_name: e.target.value})}
        placeholder={t('Tag name (e.g. environment)')}
        size="sm"
        style={{
          ...getErrorStyle(override.tag_name),
          width: '170px',
        }}
        value={override.tag_name}
      />
      <Text wrap="nowrap">{t('is')}</Text>
      <Input
        disabled={!canWrite}
        onChange={e => onUpdateOverride({...override, tag_value: e.target.value})}
        placeholder={t('Tag value (e.g. staging)')}
        size="sm"
        style={{
          ...getErrorStyle(override.tag_value),
          width: '170px',
        }}
        value={override.tag_value}
      />
      <Text wrap="nowrap">{t('look at')}</Text>
      <Input
        disabled={!canWrite}
        onChange={e => onUpdateOverride({...override, branch_name: e.target.value})}
        placeholder={t('Branch name (e.g. dev)')}
        size="sm"
        style={{
          ...getErrorStyle(override.branch_name),
          width: '170px',
        }}
        value={override.branch_name}
      />
      <Button
        aria-label={t('Remove override')}
        disabled={!canWrite}
        icon={<IconDelete size="sm" />}
        onClick={onRemoveOverride}
        priority="transparent"
        size="xs"
      />
    </Flex>
  );
}

function StatusIcon({isValid, hasAnyValue}: {hasAnyValue: boolean; isValid: boolean}) {
  if (isValid) {
    return <IconCheckmark size="sm" variant="success" />;
  }
  if (hasAnyValue) {
    return <IconClose size="sm" variant="danger" />;
  }
  return null;
}
