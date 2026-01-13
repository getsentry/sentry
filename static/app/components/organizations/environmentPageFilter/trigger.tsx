import styled from '@emotion/styled';

import {
  SelectTrigger,
  type SelectTriggerProps,
} from '@sentry/scraps/compactSelect/trigger';

import {Badge} from 'sentry/components/core/badge';
import {DesyncedFilterIndicator} from 'sentry/components/organizations/pageFilters/desyncedFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trimSlug} from 'sentry/utils/string/trimSlug';

export interface EnvironmentPageFilterTriggerProps
  extends Omit<SelectTriggerProps, 'value'> {
  desynced: boolean;
  environments: string[];
  ready: boolean;
  value: string[];
  label?: string;
}

export function EnvironmentPageFilterTrigger({
  value,
  environments,
  ready,
  desynced,
  label,
  ...props
}: EnvironmentPageFilterTriggerProps) {
  const isAllEnvironmentsSelected =
    value.length === 0 || environments.every(env => value.includes(env));

  // Show 2 environments only if the combined string's length does not exceed 25.
  // Otherwise show only 1 environment.
  const envsToShow =
    value[0]?.length! + value[1]?.length! <= 23 ? value.slice(0, 2) : value.slice(0, 1);

  // e.g. "production, staging"
  const enumeratedLabel = envsToShow.map(env => trimSlug(env, 25)).join(', ');

  const readyLabel =
    label ?? (isAllEnvironmentsSelected ? t('All Envs') : enumeratedLabel);

  // Number of environments that aren't listed in the trigger label
  const remainingCount = isAllEnvironmentsSelected ? 0 : value.length - envsToShow.length;

  return (
    <SelectTrigger.Button {...props} data-test-id="page-filter-environment-selector">
      <TriggerLabelWrap>
        <TriggerLabel>{ready ? readyLabel : t('Loading\u2026')}</TriggerLabel>
        {desynced && <DesyncedFilterIndicator role="presentation" />}
      </TriggerLabelWrap>
      {remainingCount > 0 && (
        <StyledBadge variant="muted">{`+${remainingCount}`}</StyledBadge>
      )}
    </SelectTrigger.Button>
  );
}

const TriggerLabelWrap = styled('span')`
  position: relative;
  min-width: 0;
`;

const TriggerLabel = styled('span')`
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: auto;
`;

const StyledBadge = styled(Badge)`
  margin-top: -${space(0.5)};
  margin-bottom: -${space(0.5)};
  flex-shrink: 0;
  top: auto;
`;
