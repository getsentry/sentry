import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

interface SupergroupFeedbackProps {
  supergroupId: number;
}

export function SupergroupFeedback({supergroupId}: SupergroupFeedbackProps) {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const organization = useOrganization();
  const user = useUser();

  const handleFeedback = useCallback(
    (isAccurate: boolean) => {
      trackAnalytics('supergroup.feedback_submitted', {
        choice_selected: isAccurate,
        supergroup_id: supergroupId,
        user_id: user.id,
        organization,
      });

      setFeedbackSubmitted(true);
    },
    [supergroupId, organization, user]
  );

  return (
    <FeedbackContainer>
      {feedbackSubmitted ? (
        t('Thanks!')
      ) : (
        <Flex align="center" gap="md">
          {t('Help us improve this feature. Is this grouping accurate?')}
          <Flex gap="sm">
            <Button
              size="zero"
              icon={<IconThumb direction="up" size="xs" />}
              onClick={() => handleFeedback(true)}
              aria-label={t('Yes, this grouping is accurate')}
            />
            <Button
              size="zero"
              icon={<IconThumb direction="down" size="xs" />}
              onClick={() => handleFeedback(false)}
              aria-label={t('No, this grouping is not accurate')}
            />
          </Flex>
        </Flex>
      )}
    </FeedbackContainer>
  );
}

const FeedbackContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space['2xl']};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.transparent.promotion.muted};
`;
