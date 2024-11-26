import type {FieldObject} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';

export const makeHideAiFeaturesField = (organization: Organization): FieldObject => {
  const isBaa = false; // TODO: add a check here once we have a way to check if the org is a BAA customer. Leave it as false for now.
  const isDeRegion = getRegionDataFromOrganization(organization)?.name === 'de';

  return {
    name: 'hideAiFeatures',
    type: 'boolean',
    label: t('Hide AI Features '),
    help: t('Hide features built with AI by default'),
    defaultValue: isDeRegion || isBaa, // With a BAA or in the EU, we show this toggle as on when it's disabled, even though the option is false. This means we should check for the value of this field to be true.
    disabled: ({access}) => isDeRegion || !access.has('org:write'),
    disabledReason: isBaa
      ? t(
          'To remain HIPAA compliant, Generative AI features are disabled for BAA customers'
        )
      : isDeRegion
        ? t('Generative AI features are currently not supported for the EU')
        : null,
  };
};
