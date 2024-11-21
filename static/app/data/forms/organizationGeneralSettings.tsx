import type {JsonFormObject} from 'sentry/components/forms/types';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import slugify from 'sentry/utils/slugify';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/';

const formGroups: JsonFormObject[] = [
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
        saveMessageAlertType: 'info',
        saveMessage: t(
          'You will be redirected to the new organization slug after saving'
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
      {
        name: 'uptimeAutodetection',
        type: 'boolean',
        label: t('Automatically Configure Uptime Alerts'),
        help: t('Detect most-used URLs for uptime monitoring.'),
        // TOOD(epurkhiser): Currently there's no need for users to change this
        // setting as it will just be confusing. In the future when
        // autodetection is used for suggested URLs it will make more sense to
        // for users to have the option to disable this.
        visible: false,
      },
    ],
  },
];

export default formGroups;
