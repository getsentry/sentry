import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {FeedbackItemSection} from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {frontend} from 'sentry/data/platformCategories';
import {IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import {isValidUrl} from 'sentry/utils/string/isValidUrl';

const URL_NOT_FOUND = t('URL not found');

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
}

export function FeedbackUrl({eventData, feedbackItem}: Props) {
  const theme = useTheme();

  const isFrontend = frontend.includes(feedbackItem.project?.platform ?? 'other');
  if (!isFrontend) {
    return null;
  }

  const url =
    eventData?.contexts?.feedback?.url ??
    eventData?.tags?.find(tag => tag.key === 'url')?.value;
  const crashReportId = eventData?.contexts?.feedback?.associated_event_id;
  if (crashReportId && !url) {
    return null;
  }

  const urlIsExpected = eventData?.contexts?.feedback || eventData?.tags;
  const displayUrl = urlIsExpected ? String(url ?? URL_NOT_FOUND) : undefined;
  const linkUrl = displayUrl && isValidUrl(displayUrl) ? displayUrl : undefined;
  return (
    <FeedbackItemSection
      collapsible
      icon={<IconLink size="xs" />}
      sectionKey="url"
      title={t('URL')}
    >
      <StyledTextCopyInput
        style={
          linkUrl ? {cursor: 'pointer', color: theme.tokens.content.accent} : undefined
        }
        onClick={
          linkUrl
            ? e => {
                e.preventDefault();
                openNavigateToExternalLinkModal({linkText: linkUrl});
              }
            : () => {}
        }
      >
        {displayUrl ?? ''}
      </StyledTextCopyInput>
    </FeedbackItemSection>
  );
}

const StyledTextCopyInput = styled(TextCopyInput)`
  & > input:hover {
    text-decoration: underline;
  }
`;
