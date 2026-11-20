import {IconClose} from '@sentry/icons/close';
import {useIsMutating, type UseMutationResult} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import type {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {t} from 'sentry/locale';
import {openPrsStoppingPoint} from 'sentry/utils/seer/openPrs';
import {
  getSeerProjectSettingsMutationKey,
  type SeerBulkEditVariables,
} from 'sentry/utils/seer/seerProjectSettings';
import {coaleseStoppingPoint} from 'sentry/utils/seer/stoppingPoint';
import type {SeerProjectSettingResponse} from 'sentry/utils/seer/types';
import {useCanWriteSettings} from 'sentry/utils/seer/useCanWriteSettings';
import {useDismissAlert} from 'sentry/utils/useDismissAlert';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Props {
  bulkEdit: UseMutationResult<unknown, Error, SeerBulkEditVariables>;
  mutableSearch: MutableSearch;
  settings: SeerProjectSettingResponse[];
}

export function OpenPrsBanner({bulkEdit, mutableSearch, settings}: Props) {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();
  const isRowSaving =
    useIsMutating({
      mutationKey: getSeerProjectSettingsMutationKey(organization.slug),
    }) > 0;
  const {isDismissed, dismiss} = useDismissAlert({
    key: `${organization.id}:seer-open-prs-banner`,
  });

  if (!canWrite || isDismissed || settings.length === 0) {
    return null;
  }

  const onCount = settings.filter(
    setting =>
      coaleseStoppingPoint(setting.stoppingPoint, setting.automationTuning) === 'open_pr'
  ).length;

  const disabled = isRowSaving || bulkEdit.isPending;

  const setAll = (on: boolean) =>
    bulkEdit.mutate(
      {
        query: mutableSearch.formatString(),
        selectedIds: 'all',
        stoppingPoint: openPrsStoppingPoint(on),
      },
      {
        onError: () => toast.error(t('Failed to update Open PRs')),
        onSuccess: () =>
          toast.success(on ? t('Open PRs turned on') : t('Open PRs turned off')),
      }
    );

  return (
    <Alert
      variant="info"
      trailingItems={
        <Flex gap="sm" align="center">
          <Button size="xs" disabled={disabled} onClick={() => setAll(true)}>
            {t('Turn on for all')}
          </Button>
          <Button size="xs" disabled={disabled} onClick={() => setAll(false)}>
            {t('Turn off for all')}
          </Button>
          <Button
            size="xs"
            variant="transparent"
            icon={<IconClose />}
            aria-label={t('Dismiss')}
            onClick={dismiss}
          />
        </Flex>
      }
    >
      <Flex gap="sm">
        <Text bold>{t('Open PRs')}</Text>
        <Text>{t('%s of %s projects', onCount, settings.length)}</Text>
      </Flex>
    </Alert>
  );
}
