import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {ExternalLink} from 'sentry/components/core/link';
import type {FieldObject} from 'sentry/components/forms/types';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';

export const makePreventAiField = (organization: Organization): FieldObject => {
  const regionData = getRegionDataFromOrganization(organization);
  const isUSOrg = regionData?.name === 'us';

  return {
    name: 'enablePrReviewTestGeneration',
    type: 'boolean',
    label: tct('Enable AI Code Review [badge]', {
      badge: <FeatureBadge type="beta" style={{marginBottom: '2px'}} />,
    }),
    help: tct(
      'Use AI to review, find bugs, and generate tests in pull requests [link:Learn more]',
      {
        link: (
          <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/sentry-prevent-ai/" />
        ),
      }
    ),
    visible: ({model}) => {
      // Show field when AI features are enabled (hideAiFeatures is false)
      const hideAiFeatures = model.getValue('hideAiFeatures');
      return hideAiFeatures;
    },
    disabled: ({access}) => !isUSOrg || !access.has('org:write'),
    disabledReason: isUSOrg
      ? null
      : t('AI Code Review is only available in the US region'),
  };
};
