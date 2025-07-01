import {useTheme} from '@emotion/react';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import FeedbackItemSection from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import TextCopyInput from 'sentry/components/textCopyInput';
import {frontend} from 'sentry/data/platformCategories';
import {IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';

const URL_NOT_FOUND = t('URL not found');

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
}

export default function FeedbackUrl({eventData, feedbackItem}: Props) {
  const theme = useTheme();

  const isFrontend = frontend.includes(feedbackItem.project?.platform ?? 'other');
  if (!isFrontend) {
    return null;
  }

  const mightHaveUrl = eventData?.contexts?.feedback || eventData?.tags;
  const url =
    eventData?.contexts?.feedback?.url ??
    eventData?.tags?.find(tag => tag.key === 'url')?.value;
  const crashReportId = eventData?.contexts?.feedback?.associated_event_id;
  if (crashReportId && !url) {
    return null;
  }

  const displayUrl = mightHaveUrl ? (url ?? URL_NOT_FOUND) : '';
  const urlIsLink = displayUrl.length && displayUrl !== URL_NOT_FOUND;
  return (
    <FeedbackItemSection
      collapsible
      icon={<IconLink size="xs" />}
      sectionKey="url"
      title={t('URL')}
    >
      <TextCopyInput
        style={urlIsLink ? {color: theme.blue400} : undefined}
        onClick={
          urlIsLink
            ? e => {
                e.preventDefault();
                openNavigateToExternalLinkModal({linkText: displayUrl});
              }
            : () => {}
        }
      >
        {displayUrl}
      </TextCopyInput>
    </FeedbackItemSection>
  );
}
