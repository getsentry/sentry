import {useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import LoadingError from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
import type {EventGroupingConfig} from 'sentry/types/event';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type GroupingConfigSelectProps = {
  configId: string;
  onSelect: (selection: any) => void;
};

export function GroupingConfigSelect({configId, onSelect}: GroupingConfigSelectProps) {
  const organization = useOrganization();
  const {
    data: configs,
    isPending,
    isError,
  } = useApiQuery<EventGroupingConfig[]>(
    [`/organizations/${organization.slug}/grouping-configs/`],
    {staleTime: 0, retry: false}
  );

  const options = useMemo(
    () =>
      (configs ?? []).map(({id, hidden}) => ({
        value: id,
        textValue: id,
        label: <GroupingConfigItem isHidden={hidden}>{id}</GroupingConfigItem>,
      })),
    [configs]
  );

  if (isError) {
    return <LoadingError message={t('Failed to load config options')} />;
  }

  return (
    <CompactSelect
      triggerProps={{
        title: t('Click here to experiment with other grouping configs'),
      }}
      triggerLabel={<GroupingConfigItem>{configId}</GroupingConfigItem>}
      disabled={isPending}
      size="sm"
      value={configId}
      onChange={onSelect}
      options={options}
      searchable
    />
  );
}
const GroupingConfigItem = styled('span')<{
  isHidden?: boolean;
}>`
  font-family: ${p => p.theme.text.familyMono};
  opacity: ${p => (p.isHidden ? 0.5 : null)};
  font-size: ${p => p.theme.fontSize.sm};
`;
