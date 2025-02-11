import {Fragment} from 'react';
import cloneDeep from 'lodash/cloneDeep';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {Field, FieldObject} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import type {MembershipSettingsProps} from 'sentry/types/hooks';

function OrganizationMembershipSettingsForm({
  jsonFormSettings,
  forms,
}: MembershipSettingsProps) {
  const disabled = ({features, access}: any) =>
    !access.has('org:write') || !features.has('invite-members');

  const formsCopy = cloneDeep(forms);
  formsCopy.forEach(group => {
    group.fields.forEach(field => {
      if (isField(field)) {
        field.disabled = field.disabled ?? disabled;

        if (field.name === 'defaultRole') {
          field.disabled = ({features, access}: any) =>
            !access.has('org:admin') || !features.has('invite-members');
        } else if (field.name === 'allowMemberProjectCreation') {
          field.disabled = ({features, access}: any) =>
            !access.has('org:write') || !features.has('team-roles');
          field.disabledReason = ({features}: any) =>
            !features.has('team-roles')
              ? t('You must be on a business plan to toggle this feature.')
              : undefined;
        }
      }
    });
  });

  return (
    <Fragment>
      <Feature features={['invite-members']}>
        {({hasFeature}) =>
          !hasFeature && (
            <Alert type="warning" showIcon>
              {t('You must be on a paid plan to invite additional members.')}
            </Alert>
          )
        }
      </Feature>
      <JsonForm {...jsonFormSettings} forms={formsCopy} />
    </Fragment>
  );
}

function isField(fieldObject: FieldObject): fieldObject is Field {
  return fieldObject.hasOwnProperty('name');
}

export default OrganizationMembershipSettingsForm;
