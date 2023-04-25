import {forwardRef} from 'react';
import styled from '@emotion/styled';

import Badge from 'sentry/components/badge';
import DropdownButton, {DropdownButtonProps} from 'sentry/components/dropdownButton';
import {IconWindow} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {trimSlug} from 'sentry/utils/trimSlug';

interface EnvironmentPageFilterTriggerProps extends Omit<DropdownButtonProps, 'value'> {
  environments: string[];
  ready: boolean;
  value: string[];
}

function BaseEnvironmentPageFilterTrigger(
  {value, environments, ready, ...props}: EnvironmentPageFilterTriggerProps,
  forwardedRef: React.ForwardedRef<HTMLButtonElement>
) {
  const isAllEnvironmentsSelected =
    value.length === 0 || environments.every(env => value.includes(env));

  // Show 2 environments only if the combined string's length does not exceed 25.
  // Otherwise show only 1 environment.
  const envsToShow =
    value[0]?.length + value[1]?.length <= 23 ? value.slice(0, 2) : value.slice(0, 1);

  const label = isAllEnvironmentsSelected
    ? t('All Envs')
    : envsToShow.map(env => trimSlug(env, 25)).join(', ');

  // Number of environments that aren't listed in the trigger label
  const remainingCount = isAllEnvironmentsSelected ? 0 : value.length - envsToShow.length;

  return (
    <DropdownButton {...props} ref={forwardedRef} icon={<IconWindow />}>
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

const StyledBadge = styled(Badge)`
  margin-top: -${space(0.5)};
  margin-bottom: -${space(0.5)};
  flex-shrink: 0;
  top: auto;
`;
