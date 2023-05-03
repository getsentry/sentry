import styled from '@emotion/styled';

import Avatar from 'sentry/components/avatar';
import {space} from 'sentry/styles/space';
import {OrganizationSummary, Project} from 'sentry/types';
import {getParentKey} from 'sentry/views/settings/account/notifications/utils';

type Props = {
  notificationType: string;
  parent: OrganizationSummary | Project;
};

// TODO(mgaeta): Infer parentKey from parent.
function ParentLabel({notificationType, parent}: Props) {
  return (
    <FieldLabel>
      <Avatar
        {...{
          [getParentKey(notificationType)]: parent,
        }}
      />
      <span>{parent.slug}</span>
    </FieldLabel>
  );
}

const FieldLabel = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  line-height: 16px;
`;

export default ParentLabel;
