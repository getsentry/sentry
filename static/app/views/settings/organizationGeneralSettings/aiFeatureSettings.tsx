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
  const hasFeatureFlag = organization.features.includes('gen-ai-features');

  return {
    name: 'hideAiFeatures',
    type: 'boolean',
    label: t('Show Generative AI Features'),
    help: tct('Allows organization members to access [link:generative AI features]', {
      link: (
        <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/#ai-powered-features" />
      ),
    }),
    defaultValue: defaultEnableSeerFeaturesValue(organization),
    disabled: ({access}) => !hasFeatureFlag || !access.has('org:write'),
    getValue: value => {
      // Reversing value because the field was previously called hideAiFeatures and we've inverted the behavior.
      return !value;
    },
    setValue: value => {
      if (!hasFeatureFlag) {
        return false;
      }
      return value;
    },
    disabledReason: isBaa
      ? t(
          'To remain HIPAA compliant, Generative AI features are disabled for BAA customers'
        )
      : null,
  };
};
