import {useState} from 'react';
import {IconThumb} from '@sentry/icons/iconThumb';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useUser} from 'sentry/utils/useUser';

interface SuspectCommitFeedbackProps {
  groupOwnerId: number;
  organization: Organization;
}

export function SuspectCommitFeedback({
  groupOwnerId,
  organization,
}: SuspectCommitFeedbackProps) {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const user = useUser();

  const handleFeedback = (isCorrect: boolean) => {
    const analyticsData = {
      choice_selected: isCorrect,
      group_owner_id: groupOwnerId,
      user_id: user.id,
      organization,
    };

    trackAnalytics('suspect_commit.feedback_submitted', analyticsData);

    setFeedbackSubmitted(true);
  };

  if (feedbackSubmitted) {
    return (
      <Flex align="center" gap="xs" display={{zero: 'none', sm: 'flex'}}>
        <Text as="span" size="md" variant="secondary" wrap="nowrap">
          {t('Thanks!')}
        </Text>
      </Flex>
    );
  }

  return (
    <Flex align="center" gap="xs" display={{zero: 'none', sm: 'flex'}}>
      <Text as="span" size="md" variant="secondary" wrap="nowrap">
        {t('Is this correct?')}
      </Text>
      <Flex gap="2xs">
        <Button
          size="zero"
          icon={<IconThumb size="xs" />}
          onClick={() => handleFeedback(true)}
          aria-label={t('Yes, this suspect commit is correct')}
        />
        <Button
          size="zero"
          icon={<IconThumb direction="down" size="xs" />}
          onClick={() => handleFeedback(false)}
          aria-label={t('No, this suspect commit is incorrect')}
        />
      </Flex>
    </Flex>
  );
}
