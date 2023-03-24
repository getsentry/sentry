import {useCallback} from 'react';

import ActionButton from 'sentry/components/actions/button';
import Confirm from 'sentry/components/confirm';
import FeatureBadge from 'sentry/components/featureBadge';
import {t} from 'sentry/locale';
import {Group} from 'sentry/types';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {
  experimentalFeatureTooltipDesc,
  openAISuggestionLocalStorageKey,
} from 'sentry/views/issueDetails/openAIFixSuggestion/utils';

type Props = {
  groupId: Group['id'];
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  size?: 'xs' | 'sm';
};

export function OpenAIFixSuggestionButton({
  className,
  disabled,
  size,
  onClick,
  groupId,
}: Props) {
  const organization = useOrganization();
  const router = useRouter();
  const hasSignedDPA = false;

  const [localStorageState, setLocalStorageState] = useLocalStorageState<{
    agreedForwardDataToOpenAI: boolean;
  }>(openAISuggestionLocalStorageKey(), {
    agreedForwardDataToOpenAI: false,
  });

  const handleShowAISuggestion = useCallback(() => {
    router.push({
      pathname: `/issues/${groupId}/`,
      query: {...router.location.query, openSuggestedFix: true},
    });
  }, [router, groupId]);

  const handleDataForwardToOpenAIAgreement = useCallback(() => {
    setLocalStorageState({agreedForwardDataToOpenAI: true});
    router.push({
      pathname: `/issues/${groupId}/`,
      query: {...router.location.query, openSuggestedFix: true},
    });
  }, [router, groupId, setLocalStorageState]);

  if (!organization.features.includes('open-ai-suggestion')) {
    return null;
  }

  const byPassNoGuaranteeModal =
    hasSignedDPA || localStorageState.agreedForwardDataToOpenAI;

  return (
    <Confirm
      bypass={byPassNoGuaranteeModal}
      priority="primary"
      message={t(
        'By using this feature, you agree that OpenAI is a subprocessor and may process the data that you’ve chosen to submit. Sentry makes no guarantees as to the accuracy of the feature’s AI-generated recommendations.'
      )}
      disabled={disabled}
      onConfirm={
        byPassNoGuaranteeModal
          ? handleShowAISuggestion
          : handleDataForwardToOpenAIAgreement
      }
    >
      <ActionButton
        className={className}
        disabled={disabled}
        size={size}
        onClick={onClick}
        title={experimentalFeatureTooltipDesc}
      >
        {t('Suggested Fix')}
        <FeatureBadge type="experimental" noTooltip />
      </ActionButton>
    </Confirm>
  );
}
