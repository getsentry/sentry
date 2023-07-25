import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';

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
          };
        })}
        onChange={option => handleOrgChange(option.value)}
        value={organizationId}
        styles={{
          container: (provided: {[x: string]: string | number | boolean}) => ({
            ...provided,
            minWidth: `200px`,
          }),
        }}
      />
    </OrgControlWrapper>
  );
}

const StyledSelectControl = styled(SelectControl)`
  text-transform: initial;
  font-weight: normal;
`;

const OrgControlWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
  flex-grow: 1;
`;
