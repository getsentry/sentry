import {Fragment, useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {bulkUpdate} from 'sentry/actionCreators/group';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import AutoSelectText from 'sentry/components/autoSelectText';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Switch} from 'sentry/components/core/switch';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getAnalyticsDataForEvent, getAnalyticsDataForGroup} from 'sentry/utils/events';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {SectionDivider} from 'sentry/views/issueDetails/streamline/foldSection';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

interface ShareIssueModalProps extends ModalRenderProps {
  event: Event | null;
  groupId: string;
  hasIssueShare: boolean;
  onToggle: () => void;
  organization: Organization;
  projectSlug: string;
}

type UrlRef = React.ElementRef<typeof AutoSelectText>;

export function getShareUrl(organization: Organization, group: Group) {
  const path = `/organizations/${organization.slug}/share/issue/${group.shareId}/`;
  return `${window.location.origin}${normalizeUrl(path)}`;
}

export default function ShareIssueModal({
  Header,
  Body,
  organization,
  groupId,
  closeModal,
  event,
  onToggle,
  projectSlug,
  hasIssueShare,
}: ShareIssueModalProps) {
  const [includeEventId, setIncludeEventId] = useLocalStorageState(
    'issue-details-share-event-id',
    true
  );

  const urlRef = useRef<UrlRef>(null);
  const groups = useLegacyStore(GroupStore);
  const group = (groups as Group[]).find(item => item.id === groupId);
  const api = useApi({persistInFlight: true});
  const [loading, setLoading] = useState(false);
  const isPublished = group?.isPublic;
  const hasStreamlinedUI = useHasStreamlinedUI();

  const hasPublicShare = organization.features.includes('shared-issues') && hasIssueShare;

  const issueUrl =
    includeEventId && event
      ? window.location.origin +
        normalizeUrl(
          `/organizations/${organization.slug}/issues/${group?.id}/events/${event.id}/`
        )
      : window.location.origin +
        normalizeUrl(`/organizations/${organization.slug}/issues/${group?.id}/`);

  const markdownLink = `[${group?.shortId}](${issueUrl})`;

  const {copy} = useCopyToClipboard();

  const handleCopyIssueLink = useCallback(() => {
    copy(issueUrl, {successMessage: t('Copied Issue Link to clipboard')}).then(
      closeModal
    );
  }, [copy, issueUrl, closeModal]);

  const handleCopyMarkdownLink = useCallback(() => {
    copy(markdownLink, {successMessage: t('Copied Markdown link to clipboard')}).then(
      closeModal
    );
  }, [copy, markdownLink, closeModal]);

  const handlePublicShare = useCallback(
    (e: React.ChangeEvent<HTMLInputElement> | null, reshare?: boolean) => {
      e?.preventDefault();
      setLoading(true);
      onToggle();
      bulkUpdate(
        api,
        {
          orgId: organization.slug,
          projectId: projectSlug,
          itemIds: [groupId],
          data: {
            isPublic: reshare ?? !isPublished,
          },
        },
        {
          error: () => {
            addErrorMessage(t('Error sharing'));
          },
          complete: () => {
            setLoading(false);
          },
        }
      );
    },
    [api, setLoading, onToggle, isPublished, organization.slug, projectSlug, groupId]
  );

  const shareUrl = group?.shareId ? getShareUrl(organization, group) : null;

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
              {t('Include Event ID in link')}
            </CheckboxContainer>
          )}
          <StyledButtonBar gap="xs">
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
          {hasPublicShare && (
            <Fragment>
              <SectionDivider orientation="horizontal" />
              <SwitchWrapper>
                <div>
                  <Title>{t('Create a public link')}</Title>
                  <SubText>
                    {t('Share a link with anyone outside your organization')}
                  </SubText>
                </div>
                <div>{(!group || loading) && <LoadingIndicator mini />}</div>
                <Switch
                  aria-label={isPublished ? t('Unpublish') : t('Publish')}
                  checked={isPublished}
                  size="lg"
                  onChange={handlePublicShare}
                />
              </SwitchWrapper>
              {group && !loading && isPublished && shareUrl && (
                <Fragment>
                  <UrlContainer>
                    <TextContainer>
                      <StyledAutoSelectText ref={urlRef}>{shareUrl}</StyledAutoSelectText>
                    </TextContainer>
                    <ReshareButton
                      title={t('Generate new URL. Invalidates previous URL')}
                      aria-label={t('Generate new URL')}
                      borderless
                      size="sm"
                      icon={<IconRefresh />}
                      onClick={() => handlePublicShare(null, true)}
                      analyticsEventKey="issue_details.publish_issue_modal.generate_new_url"
                      analyticsEventName="Issue Details: Publish Issue Modal Generate New URL"
                    />
                  </UrlContainer>
                  <ButtonContainer>
                    <Button
                      size="sm"
                      priority="primary"
                      disabled={!shareUrl}
                      onClick={() =>
                        copy(shareUrl, {
                          successMessage: t('Copied public link to clipboard'),
                        }).then(closeModal)
                      }
                      analyticsEventKey="issue_details.publish_issue_modal.copy_link"
                      analyticsEventName="Issue Details: Publish Issue Modal Copy Link"
                      analyticsParams={{
                        streamline: hasStreamlinedUI,
                      }}
                    >
                      {t('Copy Public Link')}
                    </Button>
                  </ButtonContainer>
                </Fragment>
              )}
            </Fragment>
          )}
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
  border: 1px solid ${p => p.theme.tokens.border.primary};
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
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
  min-width: 0;
`;

const CheckboxContainer = styled('label')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const StyledButtonBar = styled(ButtonBar)`
  justify-content: flex-end;
`;

const SwitchWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content max-content;
  align-items: center;
  gap: ${space(2)};
`;

const Title = styled('div')`
  padding-right: ${space(4)};
  white-space: nowrap;
`;

const SubText = styled('p')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.sm};
`;

const ReshareButton = styled(Button)`
  border-radius: 0;
  height: 100%;
  flex-shrink: 0;
`;

const ButtonContainer = styled('div')`
  align-self: flex-end;
`;
