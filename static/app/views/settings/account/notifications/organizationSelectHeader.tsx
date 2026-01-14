import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Select} from 'sentry/components/core/select';
import OrganizationBadge from 'sentry/components/idBadge/organizationBadge';
import {t} from 'sentry/locale';
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
    <Flex align="center" flexGrow={1} gap="md">
      {t('Settings for Organization')}
      <StyledSelectControl
        allowEmpty
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
    </Flex>
  );
}

// Resetting styles because its in a panel header
const StyledSelectControl = styled(Select)`
  text-transform: initial;
  font-weight: ${p => p.theme.fontWeight.normal};
`;
