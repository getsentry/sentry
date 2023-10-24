import {forwardRef} from 'react';
import styled from '@emotion/styled';

import Badge from 'sentry/components/badge';
import DropdownButton, {DropdownButtonProps} from 'sentry/components/dropdownButton';
import {IconWindow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trimSlug} from 'sentry/utils/trimSlug';

import {DesyncedFilterIndicator} from '../pageFilters/desyncedFilter';

interface EnvironmentPageFilterTriggerProps extends Omit<DropdownButtonProps, 'value'> {
  desynced: boolean;
  environments: string[];
  ready: boolean;
  value: string[];
}

function BaseEnvironmentPageFilterTrigger(
  {value, environments, ready, desynced, ...props}: EnvironmentPageFilterTriggerProps,
  forwardedRef: React.ForwardedRef<HTMLButtonElement>
) {
  const isAllEnvironmentsSelected =
    value.length === 0 || environments.every(env => value.includes(env));

  // Show 2 environments only if the combined string's length does not exceed 25.
  // Otherwise show only 1 environment.
  const envsToShow =
    value[0]?.length + value[1]?.length <= 23 ? value.slice(0, 2) : value.slice(0, 1);

  // e.g. "production, staging"
  const enumeratedLabel = envsToShow.map(env => trimSlug(env, 25)).join(', ');

  const label = isAllEnvironmentsSelected ? t('All Envs') : enumeratedLabel;

  // Number of environments that aren't listed in the trigger label
  const remainingCount = isAllEnvironmentsSelected ? 0 : value.length - envsToShow.length;

  return (
    <DropdownButton
      {...props}
      ref={forwardedRef}
      data-test-id="page-filter-environment-selector"
      icon={
        <TriggerIconWrap>
          <IconWindow />
          {desynced && <DesyncedFilterIndicator role="presentation" />}
        </TriggerIconWrap>
      }
    >
      <TriggerLabel>{ready ? label : t('Loading\u2026')}</TriggerLabel>
      {remainingCount > 0 && <StyledBadge text={`+${remainingCount}`} />}
    </DropdownButton>
  );
}

export const EnvironmentPageFilterTrigger = forwardRef(BaseEnvironmentPageFilterTrigger);

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis};
  width: auto;
`;

const TriggerIconWrap = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
`;

const StyledBadge = styled(Badge)`
  margin-top: -${space(0.5)};
  margin-bottom: -${space(0.5)};
  flex-shrink: 0;
  top: auto;
`;
