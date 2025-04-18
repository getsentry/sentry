import type {FieldObject} from 'sentry/components/forms/types';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';

export const defaultEnableSeerFeaturesValue = (organization: Organization) => {
  const isBaa = false; // TODO: add check here once we have a way to check if the org is a BAA customer. Leave it as false for now.
  const isDeRegion = getRegionDataFromOrganization(organization)?.name === 'de';
  return !organization.hideAiFeatures && !(isDeRegion || isBaa);
};

export const makeHideAiFeaturesField = (organization: Organization): FieldObject => {
  const isBaa = false; // TODO: add a check here once we have a way to check if the org is a BAA customer. Leave it as false for now.
  const isDeRegion = getRegionDataFromOrganization(organization)?.name === 'de';

  return {
    name: 'hideAiFeatures',
    type: 'boolean',
    label: t('Enable Seer Features'),
    help: tct('Enables [docs:features] powered by the Seer agent.', {
      docs: (
        <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/sentry-ai/" />
      ),
    }),
    defaultValue: defaultEnableSeerFeaturesValue(organization),
    disabled: ({access}) => isDeRegion || !access.has('org:write'),
    getValue: value => {
      // Reversing value because the field was previously called hideAiFeatures and we've inverted the behavior.
      return !value;
    },
    disabledReason: isBaa
      ? t(
          'To remain HIPAA compliant, Generative AI features are disabled for BAA customers'
        )
      : isDeRegion
        ? t('Generative AI features are currently not supported for the EU')
        : null,
  };
};
