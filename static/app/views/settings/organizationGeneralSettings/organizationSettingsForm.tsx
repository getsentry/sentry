import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {FeatureBadge, Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {
  AutoSaveField,
  defaultFormOptions,
  FieldGroup,
  FormSearch,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Container, Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import AvatarChooser from 'sentry/components/avatarChooser';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {Hovercard} from 'sentry/components/hovercard';
import {IconCodecov, IconLock} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {MembershipSettingsProps} from 'sentry/types/hooks';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import showNewSeer from 'sentry/utils/seer/showNewSeer';
import slugify from 'sentry/utils/slugify';
import {useMembers} from 'sentry/utils/useMembers';
import useOrganization from 'sentry/utils/useOrganization';

const HookCodecovSettingsLink = HookOrDefault({
  hookName: 'component:codecov-integration-settings-link',
});

const HookOrganizationMembershipSettings = HookOrDefault({
  hookName: 'component:organization-membership-settings',
  defaultComponent: OrganizationMembershipSettingsBase,
});

interface Props {
  initialData: Organization;
  onSave: (previous: Organization, updated: Organization) => void;
}

const slugSchema = z.object({
  slug: z.string().min(1, t('Organization slug is required')),
});

const generalSchema = z.object({
  name: z.string().min(1, t('Display name is required')),
  organizationId: z.string(),
  isEarlyAdopter: z.boolean(),
  hideAiFeatures: z.boolean(),
  codecovAccess: z.boolean(),
  enablePrReviewTestGeneration: z.boolean(),
  slug: z.string().min(1, t('Organization slug is required')),
});

type GeneralSchema = z.infer<typeof generalSchema>;
type SlugSchema = z.infer<typeof slugSchema>;

export const membershipSchema = z.object({
  defaultRole: z.string(),
  openMembership: z.boolean(),
  allowMemberInvite: z.boolean(),
  allowMemberProjectCreation: z.boolean(),
  eventsMemberAdmin: z.boolean(),
  alertsMemberWrite: z.boolean(),
  attachmentsRole: z.string(),
  debugFilesRole: z.string(),
  hasGranularReplayPermissions: z.boolean(),
  replayAccessMembers: z.array(z.string()),
});

type MembershipSchema = z.infer<typeof membershipSchema>;

export function ReplayAccessMembersField({
  organization,
  onSave,
  disabled,
}: {
  disabled: boolean;
  onSave: (previous: Organization, updated: Organization) => void;
  organization: Organization;
}) {
  const endpoint = `/organizations/${organization.slug}/`;
  const {members, fetching} = useMembers();
  const memberOptions = members.map(m => ({value: m.id, label: m.name}));

  const replayMutationOpts = mutationOptions({
    mutationFn: (data: {replayAccessMembers: string[]}) =>
      fetchMutation<Organization>({
        method: 'PUT',
        url: endpoint,
        data: {replayAccessMembers: data.replayAccessMembers.map(Number)},
      }),
    onSuccess: updated => onSave(organization, updated),
  });

  return (
    <FormSearch route="/settings/organization/">
      <AutoSaveField
        name="replayAccessMembers"
        schema={membershipSchema}
        initialValue={(organization.replayAccessMembers ?? []).map(String)}
        mutationOptions={replayMutationOpts}
      >
        {field => (
          <field.Layout.Row
            label={t('Replay Access Members')}
            hintText={t('Select the members who will have access to replay data.')}
          >
            <field.Select
              multiple
              options={memberOptions}
              value={field.state.value}
              onChange={field.handleChange}
              disabled={disabled}
              isLoading={fetching}
            />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    </FormSearch>
  );
}

function OrganizationMembershipSettingsBase({
  organization,
  onSave,
}: MembershipSettingsProps) {
  const endpoint = `/organizations/${organization.slug}/`;
  const features = new Set(organization.features);
  const access = new Set(organization.access);
  const hasOrgWrite = access.has('org:write');
  const hasOrgAdmin = access.has('org:admin');

  const hasGranularReplay = organization.hasGranularReplayPermissions ?? false;

  const roleOptions = (organization.orgRoleList ?? []).map(r => ({
    value: r.id,
    label: r.name,
  }));

  const mutationOpts = mutationOptions({
    mutationFn: (data: Partial<MembershipSchema>) =>
      fetchMutation<Organization>({method: 'PUT', url: endpoint, data}),
    onSuccess: updated => onSave(organization, updated),
  });

  return (
    <FormSearch route="/settings/organization/">
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
                disabled={!hasOrgAdmin}
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
                disabled={!hasOrgWrite}
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
                disabled={!hasOrgWrite}
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
                disabled={!hasOrgWrite}
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
                disabled={!hasOrgWrite}
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
                disabled={!hasOrgWrite}
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
                  disabled={!hasOrgWrite}
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
                disabled={!hasOrgWrite}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        {features.has('granular-replay-permissions') && (
          <Fragment>
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
                    disabled={!hasOrgWrite}
                  />
                </field.Layout.Row>
              )}
            </AutoSaveField>

            {hasGranularReplay && (
              <ReplayAccessMembersField
                organization={organization}
                onSave={onSave}
                disabled={!hasOrgWrite}
              />
            )}
          </Fragment>
        )}
      </FieldGroup>
    </FormSearch>
  );
}

function OrganizationSettingsForm({initialData, onSave}: Props) {
  const organization = useOrganization();
  const endpoint = `/organizations/${organization.slug}/`;

  const access = useMemo(() => new Set(organization.access), [organization]);
  const hasWriteAccess = access.has('org:write');
  const hasGenAiFeatureFlag = organization.features.includes('gen-ai-features');
  const isSelfHosted = ConfigStore.get('isSelfHosted');

  const aiEnabled = hasGenAiFeatureFlag ? (initialData.hideAiFeatures ?? false) : false;

  // Shared mutation options for most general fields
  const orgMutationOptions = mutationOptions({
    mutationFn: (data: Partial<GeneralSchema> | Partial<SlugSchema>) =>
      fetchMutation<Organization>({method: 'PUT', url: endpoint, data}),
    onSuccess: updated => {
      onSave(initialData, updated);
    },
    onError: () => addErrorMessage(t('Unable to save change')),
  });

  const {mutateAsync: updateSlug} = useMutation(orgMutationOptions);

  // Slug form — uses explicit Save button instead of auto-save
  const slugForm = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {slug: initialData.slug},
    validators: {onDynamic: slugSchema},
    onSubmit: ({value}) => updateSlug({slug: value.slug}).catch(() => {}),
  });

  return (
    <Fragment>
      <FormSearch route="/settings/organization/">
        <FieldGroup title={t('General')}>
          {/* Slug — explicit save with warning */}
          <slugForm.AppForm>
            <slugForm.FormWrapper>
              <slugForm.AppField name="slug">
                {field => (
                  <field.Layout.Row
                    label={t('Organization Slug')}
                    hintText={t('A unique ID used to identify this organization')}
                    required
                  >
                    <field.Input
                      value={field.state.value}
                      onChange={value => field.handleChange(slugify(value))}
                      disabled={!hasWriteAccess}
                    />
                  </field.Layout.Row>
                )}
              </slugForm.AppField>
              <slugForm.Subscribe
                selector={state => state.values.slug !== initialData.slug}
              >
                {isDirty =>
                  isDirty && (
                    <Container paddingTop="lg">
                      <Alert variant="info" showIcon={false}>
                        {tct(
                          'Changing your organization slug will break organization tokens, may impact integrations, and break links to your organization. You will be redirected to the new slug after saving. [link:Learn more]',
                          {
                            link: (
                              <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/22291009858971-Can-I-update-my-Sentry-Organization-slug" />
                            ),
                          }
                        )}
                      </Alert>
                      <Flex gap="sm" justify="end" paddingTop="lg">
                        <Button
                          onClick={() => slugForm.reset()}
                          disabled={!hasWriteAccess}
                        >
                          {t('Cancel')}
                        </Button>
                        <slugForm.SubmitButton disabled={!hasWriteAccess}>
                          {t('Save')}
                        </slugForm.SubmitButton>
                      </Flex>
                    </Container>
                  )
                }
              </slugForm.Subscribe>
            </slugForm.FormWrapper>
          </slugForm.AppForm>

          {/* Display Name */}
          <AutoSaveField
            name="name"
            schema={generalSchema}
            initialValue={initialData.name}
            mutationOptions={orgMutationOptions}
          >
            {field => (
              <field.Layout.Row
                label={t('Display Name')}
                hintText={t('A human-friendly name for the organization')}
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled={!hasWriteAccess}
                />
              </field.Layout.Row>
            )}
          </AutoSaveField>

          {/* Organization ID — read-only */}
          <AutoSaveField
            name="organizationId"
            schema={generalSchema}
            initialValue={organization.id}
            mutationOptions={orgMutationOptions}
          >
            {field => (
              <field.Layout.Row
                label={t('Organization ID')}
                hintText={t(
                  'The unique identifier for this organization. It cannot be modified.'
                )}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled
                />
              </field.Layout.Row>
            )}
          </AutoSaveField>

          {/* Early Adopter — hidden for self-hosted errors-only */}
          {!ConfigStore.get('isSelfHostedErrorsOnly') && (
            <AutoSaveField
              name="isEarlyAdopter"
              schema={generalSchema}
              initialValue={initialData.isEarlyAdopter}
              mutationOptions={orgMutationOptions}
            >
              {field => (
                <field.Layout.Row
                  label={t('Early Adopter')}
                  hintText={tct(
                    "Opt-in to [link:new features] before they're released to the public",
                    {
                      link: (
                        <ExternalLink href="https://docs.sentry.io/product/accounts/early-adopter/" />
                      ),
                    }
                  )}
                >
                  <field.Switch
                    checked={field.state.value ?? false}
                    onChange={field.handleChange}
                    disabled={!hasWriteAccess}
                  />
                </field.Layout.Row>
              )}
            </AutoSaveField>
          )}

          {/* Show Generative AI Features (inverted from hideAiFeatures) */}
          <AutoSaveField
            name="hideAiFeatures"
            schema={generalSchema}
            initialValue={aiEnabled}
            mutationOptions={mutationOptions({
              mutationFn: (data: Partial<GeneralSchema>) =>
                fetchMutation<Organization>({
                  method: 'PUT',
                  url: endpoint,
                  // Invert: form true (AI shown) → API hideAiFeatures: false
                  data: {hideAiFeatures: !data.hideAiFeatures},
                }),
              onSuccess: updated => {
                onSave(initialData, updated);
              },
              onError: () => {
                addErrorMessage(t('Unable to save change'));
              },
            })}
          >
            {field => (
              <field.Layout.Row
                label={t('Show Generative AI Features')}
                hintText={tct(
                  'Allows organization members to access [link:generative AI features]',
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/#ai-powered-features" />
                    ),
                  }
                )}
              >
                <field.Switch
                  checked={field.state.value ?? false}
                  onChange={field.handleChange}
                  disabled={!hasGenAiFeatureFlag || !hasWriteAccess}
                />
              </field.Layout.Row>
            )}
          </AutoSaveField>

          {/* Enable Code Coverage Insights */}
          <AutoSaveField
            name="codecovAccess"
            schema={generalSchema}
            initialValue={initialData.codecovAccess}
            mutationOptions={orgMutationOptions}
          >
            {field => (
              <field.Layout.Row
                label={
                  <PoweredByCodecov>
                    {t('Enable Code Coverage Insights')}{' '}
                    <Feature
                      hookName="feature-disabled:codecov-integration-setting"
                      renderDisabled={p => (
                        <Hovercard
                          body={
                            <FeatureDisabled
                              features={p.features}
                              hideHelpToggle
                              featureName={t('Codecov Coverage')}
                            />
                          }
                        >
                          <Tag variant="muted" role="status" icon={<IconLock locked />}>
                            {t('disabled')}
                          </Tag>
                        </Hovercard>
                      )}
                      features="organizations:codecov-integration"
                    >
                      {() => null}
                    </Feature>
                  </PoweredByCodecov>
                }
                hintText={
                  <PoweredByCodecov>
                    {t('powered by')} <IconCodecov /> Codecov{' '}
                    <HookCodecovSettingsLink organization={organization} />
                  </PoweredByCodecov>
                }
              >
                <field.Switch
                  checked={field.state.value ?? false}
                  onChange={field.handleChange}
                  disabled={
                    !organization.features.includes('codecov-integration') ||
                    !hasWriteAccess
                  }
                />
              </field.Layout.Row>
            )}
          </AutoSaveField>

          {/* Enable AI Code Review — visible when AI enabled and not using new Seer */}
          {!showNewSeer(organization) && aiEnabled && (
            <AutoSaveField
              name="enablePrReviewTestGeneration"
              schema={generalSchema}
              initialValue={initialData.enablePrReviewTestGeneration ?? false}
              mutationOptions={orgMutationOptions}
            >
              {field => (
                <field.Layout.Row
                  label={
                    <Flex gap="sm" align="center">
                      {t('Enable AI Code Review')}
                      <FeatureBadge
                        type="beta"
                        {...(isSelfHosted ? {tooltipProps: {position: 'top'}} : {})}
                      />
                      {isSelfHosted && (
                        <Tooltip
                          title={t(
                            'This feature is not available for self-hosted instances'
                          )}
                          position="top"
                        >
                          <Tag
                            variant="muted"
                            role="status"
                            icon={<IconLock locked />}
                            data-test-id="prevent-ai-disabled-tag"
                          >
                            {t('disabled')}
                          </Tag>
                        </Tooltip>
                      )}
                    </Flex>
                  }
                  hintText={tct(
                    'Use AI to review and find bugs in pull requests [link:Learn more]',
                    {
                      link: (
                        <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/ai-code-review/" />
                      ),
                    }
                  )}
                >
                  <field.Switch
                    checked={field.state.value ?? false}
                    onChange={field.handleChange}
                    disabled={isSelfHosted || !hasWriteAccess}
                  />
                </field.Layout.Row>
              )}
            </AutoSaveField>
          )}
        </FieldGroup>
      </FormSearch>

      <HookOrganizationMembershipSettings organization={organization} onSave={onSave} />

      <AvatarChooser
        type="organization"
        supportedTypes={['upload', 'letter_avatar']}
        endpoint={`${endpoint}avatar/`}
        model={initialData}
        onSave={updateOrganization}
        disabled={!hasWriteAccess}
      />
    </Fragment>
  );
}

export default OrganizationSettingsForm;

const PoweredByCodecov = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};

  & > span {
    display: flex;
    align-items: center;
  }
`;
