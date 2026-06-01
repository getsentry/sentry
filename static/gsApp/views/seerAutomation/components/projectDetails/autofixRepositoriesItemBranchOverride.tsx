import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {SeerProjectRepoBranchOverrideInput} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerRepos';
import {isOverrideValid} from 'sentry/components/events/autofix/utils/isOverrideValid';
import {overrideHasAnyValue} from 'sentry/components/events/autofix/utils/overrideHasAnyValue';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {IconClose} from 'sentry/icons/iconClose';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';

interface Props {
  canWrite: boolean;
  onRemoveOverride: () => void;
  onUpdateOverride: (updatedOverride: SeerProjectRepoBranchOverrideInput) => void;
  override: SeerProjectRepoBranchOverrideInput;
}

export function AutofixRepositoriesItemBranchOverride({
  canWrite,
  onRemoveOverride,
  onUpdateOverride,
  override,
}: Props) {
  const theme = useTheme();
  const hasAnyValue = Boolean(overrideHasAnyValue(override));
  const isValid = isOverrideValid(override);

  const getErrorStyle = (value: string) =>
    hasAnyValue && !value.trim()
      ? {borderColor: theme.tokens.border.danger.vibrant}
      : undefined;

  return (
    <Flex align="center" gap="sm">
      <Flex width="14px">
        <StatusIcon isValid={isValid} hasAnyValue={hasAnyValue} />
      </Flex>
      <Text wrap="nowrap">{t('When')}</Text>
      <Input
        disabled={!canWrite}
        onChange={e => onUpdateOverride({...override, tagName: e.target.value})}
        placeholder={t('Tag name (e.g. environment)')}
        size="sm"
        style={{
          ...getErrorStyle(override.tagName),
          width: '170px',
        }}
        value={override.tagName}
      />
      <Text wrap="nowrap">{t('is')}</Text>
      <Input
        disabled={!canWrite}
        onChange={e => onUpdateOverride({...override, tagValue: e.target.value})}
        placeholder={t('Tag value (e.g. staging)')}
        size="sm"
        style={{
          ...getErrorStyle(override.tagValue),
          width: '170px',
        }}
        value={override.tagValue}
      />
      <Text wrap="nowrap">{t('look at')}</Text>
      <Input
        disabled={!canWrite}
        onChange={e => onUpdateOverride({...override, branchName: e.target.value})}
        placeholder={t('Branch name (e.g. dev)')}
        size="sm"
        style={{
          ...getErrorStyle(override.branchName),
          width: '170px',
        }}
        value={override.branchName}
      />
      <Button
        aria-label={t('Remove override')}
        disabled={!canWrite}
        icon={<IconDelete size="sm" />}
        onClick={onRemoveOverride}
        variant="transparent"
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
