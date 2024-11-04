import {useMemo} from 'react';
import styled from '@emotion/styled';

import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownButton from 'sentry/components/dropdownButton';
import LoadingError from 'sentry/components/loadingError';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {EventGroupingConfig} from 'sentry/types/event';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

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
    <DropdownAutoComplete busy={isPending} onSelect={onSelect} items={options}>
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

const GroupingConfigItem = styled('span')<{
  isActive?: boolean;
  isHidden?: boolean;
}>`
  font-family: ${p => p.theme.text.familyMono};
  opacity: ${p => (p.isHidden ? 0.5 : null)};
  font-weight: ${p => (p.isActive ? 'bold' : null)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default GroupingConfigSelect;
