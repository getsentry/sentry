import {ExternalLink} from 'sentry/components/core/link';
import type {JsonFormObject} from 'sentry/components/forms/types';
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

export default formGroups;
