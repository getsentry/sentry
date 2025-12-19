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

export const makePreventAiField = (organization: Organization): FieldObject => {
  const isSelfHosted = ConfigStore.get('isSelfHosted');

  const isDisabled = isSelfHosted;
  const disabledReason = t('This feature is not available for self-hosted instances');

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
    help: tct('Use AI to review and find bugs in pull requests [link:Learn more]', {
      link: (
        <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/ai-code-review/" />
      ),
    }),
    visible: ({model}) => {
      if (organization.features.includes('seat-based-seer-enabled')) {
        return false;
      }

      if (
        organization.features.includes('seer-added') ||
        organization.features.includes('code-review-beta')
      ) {
        // This looks flipped but it's just a weirdly named field
        return model.getValue('hideAiFeatures');
      }

      return false;
    },
    disabled: ({access}) => isDisabled || !access.has('org:write'),
  };
};
