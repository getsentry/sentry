import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import AutoSelectText from 'sentry/components/autoSelectText';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Checkbox from 'sentry/components/checkbox';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getAnalyticsDataForEvent, getAnalyticsDataForGroup} from 'sentry/utils/events';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

interface ShareIssueModalProps extends ModalRenderProps {
  event: Event | null;
  groupId: string;
  organization: Organization;
}

type UrlRef = React.ElementRef<typeof AutoSelectText>;

export function getShareUrl(group: Group) {
  const path = `/share/issue/${group.shareId}/`;
  const {host, protocol} = window.location;
  return `${protocol}//${host}${path}`;
}

export default function ShareIssueModal({
  Header,
  Body,
  organization,
  groupId,
  closeModal,
  event,
}: ShareIssueModalProps) {
  const [includeEventId, setIncludeEventId] = useLocalStorageState(
    'issue-details-share-event-id',
    true
  );

  const urlRef = useRef<UrlRef>(null);
  const groups = useLegacyStore(GroupStore);
  const group = (groups as Group[]).find(item => item.id === groupId);

  const issueUrl =
    includeEventId && event
      ? window.location.origin +
        normalizeUrl(
          `/organizations/${organization.slug}/issues/${group?.id}/events/${event.id}/`
        )
      : window.location.origin +
        normalizeUrl(`/organizations/${organization.slug}/issues/${group?.id}/`);

  const markdownLink = `[${group?.shortId}](${issueUrl})`;

  const {onClick: handleCopyIssueLink} = useCopyToClipboard({
    text: issueUrl,
    successMessage: t('Copied Issue Link to clipboard'),
    onCopy: closeModal,
  });

  const {onClick: handleCopyMarkdownLink} = useCopyToClipboard({
    text: markdownLink,
    successMessage: t('Copied Markdown link to clipboard'),
    onCopy: closeModal,
  });

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Share Issue')}</h4>
      </Header>
      <Body>
        <ModalContent>
          <UrlContainer>
            <TextContainer>
              <StyledAutoSelectText ref={urlRef}>{issueUrl}</StyledAutoSelectText>
            </TextContainer>
          </UrlContainer>
          {event && (
            <CheckboxContainer>
              <Checkbox
                checked={includeEventId}
                onChange={() => setIncludeEventId(!includeEventId)}
              />
              <span onClick={() => setIncludeEventId(!includeEventId)}>
                {t('Include Event ID in link')}
              </span>
            </CheckboxContainer>
          )}
          <StyledButtonBar gap={0.5}>
            <Button
              size="sm"
              onClick={handleCopyMarkdownLink}
              analyticsEventKey="issue_details.copy_issue_markdown_link_clicked"
              analyticsEventName="Issue Details: Copy Issue Markdown Link"
              analyticsParams={{
                ...getAnalyticsDataForGroup(group),
                streamline: true,
              }}
            >
              {t('Copy as Markdown')}
            </Button>
            <Button
              priority="primary"
              size="sm"
              onClick={handleCopyIssueLink}
              analyticsEventKey={
                includeEventId
                  ? 'issue_details.copy_event_link_clicked'
                  : 'issue_details.copy_issue_url_clicked'
              }
              analyticsEventName={
                includeEventId
                  ? 'Issue Details: Copy Event Link Clicked'
                  : 'Issue Details: Copy Issue URL'
              }
              analyticsParams={
                includeEventId && event
                  ? {
                      ...getAnalyticsDataForGroup(group),
                      ...getAnalyticsDataForEvent(event),
                      streamline: true,
                    }
                  : {
                      ...getAnalyticsDataForGroup(group),
                      streamline: true,
                    }
              }
            >
              {t('Copy Link')}
            </Button>
          </StyledButtonBar>
        </ModalContent>
      </Body>
    </Fragment>
  );
}

const ModalContent = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
`;

const UrlContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content max-content;
  align-items: center;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${space(0.5)};
  width: 100%;
`;

const StyledAutoSelectText = styled(AutoSelectText)`
  padding: ${space(1)} ${space(1)};
  ${p => p.theme.overflowEllipsis}
`;

const TextContainer = styled('div')`
  position: relative;
  display: flex;
  flex-grow: 1;
  background-color: transparent;
  border-right: 1px solid ${p => p.theme.border};
  min-width: 0;
`;

const CheckboxContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const StyledButtonBar = styled(ButtonBar)`
  justify-content: flex-end;
`;
