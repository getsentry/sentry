import {ExternalLink} from 'sentry/components/core/link';
import type {FieldObject} from 'sentry/components/forms/types';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

export const defaultEnableSeerFeaturesValue = (organization: Organization) => {
  const isBaa = false; // TODO: add check here once we have a way to check if the org is a BAA customer. Leave it as false for now.
  return !organization.hideAiFeatures && !isBaa;
};

export const makeHideAiFeaturesField = (organization: Organization): FieldObject => {
  const isBaa = false; // TODO: add a check here once we have a way to check if the org is a BAA customer. Leave it as false for now.

  return {
    name: 'hideAiFeatures',
    type: 'boolean',
    label: t('Show Generative AI Features'),
    help: tct(
      'Allows organization members to access [docs:features] powered by generative AI',
      {
        docs: (
          <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/sentry-ai/" />
        ),
      }
    ),
    defaultValue: defaultEnableSeerFeaturesValue(organization),
    disabled: ({access}) => !access.has('org:write'),
    getValue: value => {
      // Reversing value because the field was previously called hideAiFeatures and we've inverted the behavior.
      return !value;
    },
    disabledReason: isBaa
      ? t(
          'To remain HIPAA compliant, Generative AI features are disabled for BAA customers'
        )
      : null,
  };
};
