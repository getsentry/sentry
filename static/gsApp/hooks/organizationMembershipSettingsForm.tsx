import {Fragment} from 'react';
import {mutationOptions} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {AutoSaveField, FieldGroup} from '@sentry/scraps/form';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import type {MembershipSettingsProps} from 'sentry/types/hooks';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation} from 'sentry/utils/queryClient';
import {
  membershipSchema,
  ReplayAccessMembersField,
} from 'sentry/views/settings/organizationGeneralSettings/organizationSettingsForm';

function OrganizationMembershipSettingsForm({
  organization,
  onSave,
}: MembershipSettingsProps) {
  const endpoint = `/organizations/${organization.slug}/`;
  const features = new Set(organization.features);
  const access = new Set(organization.access);

  const hasInviteMembers = features.has('invite-members');
  const hasTeamRoles = features.has('team-roles');
  const hasOrgWrite = access.has('org:write');
  const hasOrgAdmin = access.has('org:admin');

  const hasGranularReplay = organization.hasGranularReplayPermissions ?? false;

  const roleOptions = (organization.orgRoleList ?? []).map(r => ({
    value: r.id,
    label: r.name,
  }));

  const mutationOpts = mutationOptions({
    mutationFn: (data: Partial<Organization>) =>
      fetchMutation<Organization>({method: 'PUT', url: endpoint, data}),
    onSuccess: updated => onSave(organization, updated),
  });

  // All fields are disabled if the org lacks the invite-members feature or user lacks org:write
  const baseDisabled = !hasOrgWrite || !hasInviteMembers;

  return (
    <Fragment>
      <Feature features={['invite-members']}>
        {({hasFeature}) =>
          !hasFeature && (
            <Alert.Container>
              <Alert variant="warning">
                {t('You must be on a paid plan to invite additional members.')}
              </Alert>
            </Alert.Container>
          )
        }
      </Feature>
      <FieldGroup title={t('Membership')}>
        <AutoSaveField
          name="defaultRole"
          schema={membershipSchema}
          initialValue={organization.defaultRole ?? ''}
          mutationOptions={mutationOpts}
        >
          {field => (
            <field.Layout.Row
              label={t('Default Role')}
              hintText={t('The default role new members will receive')}
            >
              <field.Select
                options={roleOptions}
                value={field.state.value}
                onChange={field.handleChange}
                disabled={baseDisabled || !hasOrgAdmin || !hasInviteMembers}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="openMembership"
          schema={membershipSchema}
          initialValue={organization.openMembership ?? false}
          mutationOptions={mutationOpts}
          confirm={value =>
            value
              ? t(
                  'This will allow any members of your organization to freely join any team and access any project of your organization. Do you want to continue?'
                )
              : t(
                  'This will disallow free access to any team and project within your organization. Do you want to continue?'
                )
          }
        >
          {field => (
            <field.Layout.Row
              label={t('Open Team Membership')}
              hintText={t('Allow organization members to freely join any team')}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={baseDisabled}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="allowMemberInvite"
          schema={membershipSchema}
          initialValue={organization.allowMemberInvite ?? false}
          mutationOptions={mutationOpts}
          confirm={value =>
            value
              ? t(
                  'This will allow any members of your organization to invite other members via email without needing org owner or manager approval. Do you want to continue?'
                )
              : undefined
          }
        >
          {field => (
            <field.Layout.Row
              label={t('Let Members Invite Others')}
              hintText={t(
                'Allow organization members to invite other members via email without needing org owner or manager approval.'
              )}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={baseDisabled}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="allowMemberProjectCreation"
          schema={membershipSchema}
          initialValue={organization.allowMemberProjectCreation ?? false}
          mutationOptions={mutationOpts}
          confirm={value =>
            value
              ? t(
                  'This will allow any members of your organization to create and configure new projects. Do you want to continue?'
                )
              : undefined
          }
        >
          {field => (
            <field.Layout.Row
              label={t('Let Members Create Projects')}
              hintText={t(
                'Allow organization members to create and configure new projects.'
              )}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={
                  !hasOrgWrite ||
                  (!hasTeamRoles &&
                    t('You must be on a business plan to toggle this feature.'))
                }
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="eventsMemberAdmin"
          schema={membershipSchema}
          initialValue={organization.eventsMemberAdmin ?? false}
          mutationOptions={mutationOpts}
          confirm={value =>
            value
              ? t(
                  'This will allow any members of your organization to delete events. Do you want to continue?'
                )
              : undefined
          }
        >
          {field => (
            <field.Layout.Row
              label={t('Let Members Delete Events')}
              hintText={t(
                'Allow members to delete events (including the delete & discard action) by granting them the `event:admin` scope.'
              )}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={baseDisabled}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="alertsMemberWrite"
          schema={membershipSchema}
          initialValue={organization.alertsMemberWrite ?? false}
          mutationOptions={mutationOpts}
          confirm={value =>
            value
              ? t(
                  'This will allow any members of your organization to create, edit, and delete alert rules in all projects. Do you want to continue?'
                )
              : undefined
          }
        >
          {field => (
            <field.Layout.Row
              label={t('Let Members Create and Edit Alerts')}
              hintText={t(
                'Allow members to create, edit, and delete alert rules by granting them the `alerts:write` scope.'
              )}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={baseDisabled}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        {features.has('event-attachments') && (
          <AutoSaveField
            name="attachmentsRole"
            schema={membershipSchema}
            initialValue={organization.attachmentsRole ?? ''}
            mutationOptions={mutationOpts}
          >
            {field => (
              <field.Layout.Row
                label={t('Attachments Access')}
                hintText={t(
                  'Role required to download event attachments, such as native crash reports or log files.'
                )}
              >
                <field.Select
                  options={roleOptions}
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled={baseDisabled}
                />
              </field.Layout.Row>
            )}
          </AutoSaveField>
        )}

        <AutoSaveField
          name="debugFilesRole"
          schema={membershipSchema}
          initialValue={organization.debugFilesRole ?? ''}
          mutationOptions={mutationOpts}
        >
          {field => (
            <field.Layout.Row
              label={t('Debug Files Access')}
              hintText={t(
                'Role required to download debug information files, proguard mappings and source maps.'
              )}
            >
              <field.Select
                options={roleOptions}
                value={field.state.value}
                onChange={field.handleChange}
                disabled={baseDisabled}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        {features.has('granular-replay-permissions') && (
          <AutoSaveField
            name="hasGranularReplayPermissions"
            schema={membershipSchema}
            initialValue={organization.hasGranularReplayPermissions ?? false}
            mutationOptions={mutationOpts}
            confirm={value =>
              value
                ? undefined
                : t(
                    'This will allow all members of your organization to access replay data. Do you want to continue?'
                  )
            }
          >
            {field => (
              <field.Layout.Row
                label={t('Restrict Replay Access')}
                hintText={t(
                  'Allow granular access to replay data by selecting specific members of your organization.'
                )}
              >
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled={baseDisabled}
                />
              </field.Layout.Row>
            )}
          </AutoSaveField>
        )}

        {features.has('granular-replay-permissions') && hasGranularReplay && (
          <ReplayAccessMembersField
            organization={organization}
            onSave={onSave}
            disabled={baseDisabled}
          />
        )}
      </FieldGroup>
    </Fragment>
  );
}

export default OrganizationMembershipSettingsForm;
