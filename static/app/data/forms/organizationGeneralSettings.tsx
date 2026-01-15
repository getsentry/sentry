import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Tag} from 'sentry/components/core/badge/tag';
import {ExternalLink} from 'sentry/components/core/link';
import type {FieldObject, JsonFormObject} from 'sentry/components/forms/types';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {Hovercard} from 'sentry/components/hovercard';
import type {FormSearchContext} from 'sentry/data/forms/accountDetails';
import {IconCodecov, IconLock} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import slugify from 'sentry/utils/slugify';
import {makeHideAiFeaturesField} from 'sentry/views/settings/organizationGeneralSettings/aiFeatureSettings';
import {makePreventAiField} from 'sentry/views/settings/organizationGeneralSettings/preventAiSettings';


const HookCodecovSettingsLink = HookOrDefault({
  hookName: 'component:codecov-integration-settings-link',
});

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/';

const baseFormGroups: readonly JsonFormObject[] = [
  {
    // Form "section"/"panel"
    title: t('General'),
    fields: [
      {
        name: 'slug',
        type: 'string',
        required: true,
        label: t('Organization Slug'),
        help: t('A unique ID used to identify this organization'),
        transformInput: slugify,
        saveOnBlur: false,
        saveMessageAlertVariant: 'info',
        saveMessage: tct(
          'Changing your organization slug will break organization tokens, may impact integrations, and break links to your organization. You will be redirected to the new slug after saving. [link:Learn more]',
          {
            link: (
              <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/22291009858971-Can-I-update-my-Sentry-Organization-slug" />
            ),
          }
        ),
      },
      {
        name: 'name',
        type: 'string',
        required: true,
        label: t('Display Name'),
        help: t('A human-friendly name for the organization'),
      },
      {
        name: 'isEarlyAdopter',
        type: 'boolean',
        label: t('Early Adopter'),
        help: tct("Opt-in to [link:new features] before they're released to the public", {
          link: (
            <ExternalLink href="https://docs.sentry.io/product/accounts/early-adopter/" />
          ),
        }),
        visible: () => !ConfigStore.get('isSelfHostedErrorsOnly'),
      },
    ],
  },
];

/**
 * Factory function to create organization general settings form with all fields.
 * Accepts FormSearchContext for consistency with other form factories.
 */
export function createOrganizationGeneralSettingsForm(
  context: FormSearchContext
): readonly JsonFormObject[] {
  const {organization, access} = context;

  if (!organization) {
    return baseFormGroups;
  }
  const baseFields = baseFormGroups[0]!.fields;

  const additionalFields: FieldObject[] = [
    makeHideAiFeaturesField(organization),
    {
      name: 'codecovAccess',
      type: 'boolean',
      disabled:
        !organization.features.includes('codecov-integration') ||
        !access.has('org:write'),
      label: (
        <span style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
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
        </span>
      ),
      formatMessageValue: (value: boolean) => {
        const onOff = value ? t('on') : t('off');
        return t('Codecov access was turned %s', onOff);
      },
      help: (
        <span style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
          {t('powered by')} <IconCodecov /> Codecov{' '}
          <HookCodecovSettingsLink organization={organization} />
        </span>
      ),
    },
    makePreventAiField(organization),
  ];

  return [
    {
      ...baseFormGroups[0]!,
      fields: [
        baseFields[0]!, // slug
        baseFields[1]!, // name
        {
          name: 'organizationId',
          type: 'string',
          disabled: true,
          label: t('Organization ID'),
          setValue(_, _name) {
            return organization.id;
          },
          help: `The unique identifier for this organization. It cannot be modified.`,
        },
        baseFields[2]!, // isEarlyAdopter
        ...additionalFields,
      ],
    },
  ];
}

export default baseFormGroups;
