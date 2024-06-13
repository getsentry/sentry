import {useMemo} from 'react';
import styled from '@emotion/styled';

import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownButton from 'sentry/components/dropdownButton';
import LoadingError from 'sentry/components/loadingError';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {EventGroupingConfig} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {GroupingConfigItem} from '.';

type GroupingConfigSelectProps = {
  configId: string;
  eventConfigId: string;
  onSelect: (selection: any) => void;
};

export function GroupingConfigSelect({
  configId,
  eventConfigId,
  onSelect,
}: GroupingConfigSelectProps) {
  const organization = useOrganization();
  const {
    data: configs,
    isLoading,
    isError,
  } = useApiQuery<EventGroupingConfig[]>(
    [`/organizations/${organization.slug}/grouping-configs/`],
    {staleTime: 0, retry: false}
  );

  const options = useMemo(
    () =>
      (configs ?? []).map(({id, hidden}) => ({
        value: id,
        label: (
          <GroupingConfigItem isHidden={hidden} isActive={id === eventConfigId}>
            {id}
          </GroupingConfigItem>
        ),
      })),
    [configs, eventConfigId]
  );

  if (isError) {
    return <LoadingError message={t('Failed to load config options')} />;
  }

  return (
    <DropdownAutoComplete busy={isLoading} onSelect={onSelect} items={options}>
      {({isOpen}) => (
        <Tooltip title={t('Click here to experiment with other grouping configs')}>
          <StyledDropdownButton isOpen={isOpen} size="sm">
            <GroupingConfigItem isActive={eventConfigId === configId}>
              {configId}
            </GroupingConfigItem>
          </StyledDropdownButton>
        </Tooltip>
      )}
    </DropdownAutoComplete>
  );
}

const StyledDropdownButton = styled(DropdownButton)`
  font-weight: inherit;
`;

export default GroupingConfigSelect;
