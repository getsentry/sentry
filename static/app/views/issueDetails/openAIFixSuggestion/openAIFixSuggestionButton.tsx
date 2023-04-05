import {useCallback} from 'react';

import ActionButton from 'sentry/components/actions/button';
import FeatureBadge from 'sentry/components/featureBadge';
import {t} from 'sentry/locale';
import {Group} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {experimentalFeatureTooltipDesc} from 'sentry/views/issueDetails/openAIFixSuggestion/utils';

type Props = {
  activeSuperUser: boolean;
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
  activeSuperUser,
}: Props) {
  const organization = useOrganization();
  const router = useRouter();
  const groupLink = normalizeUrl(
    `/organizations/${organization.slug}/issues/${groupId}/`
  );

  const handleShowAISuggestion = useCallback(() => {
    onClick();
    router.push({
      pathname: groupLink,
      query: {...router.location.query, showSuggestedFix: true},
    });
  }, [router, groupLink, onClick]);

  if (!organization.features.includes('open-ai-suggestion')) {
    return null;
  }

  return (
    <ActionButton
      className={className}
      disabled={activeSuperUser || disabled}
      title={
        <div>
          {experimentalFeatureTooltipDesc}
          <FeatureBadge type="experimental" noTooltip />
        </div>
      }
      size={size}
      onClick={handleShowAISuggestion}
    >
      {t('Suggested Fix')}
    </ActionButton>
  );
}
