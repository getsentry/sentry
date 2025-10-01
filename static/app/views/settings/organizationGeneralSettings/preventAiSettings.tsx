import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import type {FieldObject} from 'sentry/components/forms/types';
import {IconLock} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';

export const makePreventAiField = (organization: Organization): FieldObject => {
  const regionData = getRegionDataFromOrganization(organization);
  const isUSOrg = regionData?.name?.toLowerCase() === 'us';
  const isSelfHosted = ConfigStore.get('isSelfHosted');

  const isDisabled = isSelfHosted || !isUSOrg;
  const disabledReason = isSelfHosted
    ? t('This feature is not available for self-hosted instances')
    : t('This feature is only available in the US region');

  return {
    name: 'enablePrReviewTestGeneration',
    type: 'boolean',
    label: (
      <Flex gap="sm" align="center">
        {t('Enable AI Code Review')}
        <FeatureBadge
          type="beta"
          {...(isDisabled ? {tooltipProps: {position: 'top'}} : {})}
        />
        {isDisabled && (
          <Tooltip title={disabledReason} position="top">
            <Tag
              role="status"
              icon={<IconLock locked />}
              data-test-id="prevent-ai-disabled-tag"
            >
              {t('disabled')}
            </Tag>
          </Tooltip>
        )}
      </Flex>
    ),
    help: tct(
      'Use AI to review, find bugs, and generate tests in pull requests [link:Learn more]',
      {
        link: (
          <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/ai-code-review/" />
        ),
      }
    ),
    visible: ({model}) => {
      // Show field when AI features are enabled (hideAiFeatures is false)
      const hideAiFeatures = model.getValue('hideAiFeatures');
      return hideAiFeatures;
    },
    disabled: ({access}) => isDisabled || !access.has('org:write'),
  };
};
