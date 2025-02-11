import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import OrganizationBadge from 'sentry/components/idBadge/organizationBadge';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

type OrganizationSelectHeaderProps = {
  handleOrgChange: (orgId: string) => void;
  organizationId: string | undefined;
  organizations: Organization[];
};

export function OrganizationSelectHeader({
  handleOrgChange,
  organizationId,
  organizations,
}: OrganizationSelectHeaderProps) {
  return (
    <OrgControlWrapper>
      {t('Settings for Organization')}
      <StyledSelectControl
        options={organizations.map(org => {
          return {
            label: org.name,
            value: org.id,
            leadingItems: (
              <OrganizationBadge
                organization={org}
                avatarSize={20}
                avatarProps={{consistentWidth: true}}
                hideName
              />
            ),
          };
        })}
        onChange={(option: any) => handleOrgChange(option.value)}
        value={organizationId}
        styles={{
          container: (provided: Record<string, string>) => ({
            ...provided,
            minWidth: `200px`,
          }),
        }}
      />
    </OrgControlWrapper>
  );
}

// Resetting styles because its in a panel header
const StyledSelectControl = styled(SelectControl)`
  text-transform: initial;
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const OrgControlWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  flex-grow: 1;
`;
