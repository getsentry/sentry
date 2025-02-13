import {Fragment, useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {bulkUpdate} from 'sentry/actionCreators/group';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import AutoSelectText from 'sentry/components/autoSelectText';
import {Button} from 'sentry/components/button';
import Checkbox from 'sentry/components/checkbox';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Switch from 'sentry/components/switchButton';
import {IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

interface ShareIssueModalProps extends ModalRenderProps {
  eventId: string | undefined;
  groupId: string;
  onToggle: () => void;
  organization: Organization;
  projectSlug: string;
}

type UrlRef = React.ElementRef<typeof AutoSelectText>;

export function getShareUrl(group: Group) {
  const path = `/share/issue/${group.shareId}/`;
  const {host, protocol} = window.location;
  return `${protocol}//${host}${path}`;
}

export default function StreamlinedShareIssueModal({
  Header,
  Body,
  organization,
  projectSlug,
  groupId,
  onToggle,
  closeModal,
  eventId,
}: ShareIssueModalProps) {
  const api = useApi({persistInFlight: true});
  const [loading, setLoading] = useState(false);
  const [hasEventId, setHasEventId] = useLocalStorageState(
    'issue-details-share-event-id',
    true
  );
  const [hasMarkdownLink, setHasMarkdownLink] = useLocalStorageState(
    'issue-details-share-markdown-link',
    false
  );
  const urlRef = useRef<UrlRef>(null);
  const groups = useLegacyStore(GroupStore);
  const group = (groups as Group[]).find(item => item.id === groupId);
  const isShared = group?.isPublic;

  const issueUrl = hasEventId
    ? window.location.origin +
      normalizeUrl(
        `/organizations/${organization.slug}/issues/${group?.id}/events/${eventId}/`
      )
    : window.location.origin +
      normalizeUrl(`/organizations/${organization.slug}/issues/${group?.id}/`);

  const issueLink = hasMarkdownLink ? `[${group?.shortId}](${issueUrl})` : issueUrl;

  const {onClick: handleCopyIssueUrl} = useCopyToClipboard({
    text: issueLink,
    successMessage: t('Copied Issue URL to clipboard'),
  });

  const handleShare = useCallback(
    (e: React.MouseEvent<HTMLButtonElement> | null, reshare?: boolean) => {
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
            isPublic: reshare ?? !isShared,
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
    [api, setLoading, onToggle, isShared, organization.slug, projectSlug, groupId]
  );

  const shareUrl = group?.shareId ? getShareUrl(group) : null;

  const {onClick: handleCopy} = useCopyToClipboard({
    text: shareUrl!,
    onCopy: closeModal,
  });

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Share Issue')}</h4>
      </Header>
      <Body>
        <ModalContent>
          <IssueLinkWrapper>
            <UrlContainer>
              <TextContainer>
                <StyledAutoSelectText ref={urlRef}>{issueLink}</StyledAutoSelectText>
              </TextContainer>
              <ClipboardButton
                text={issueLink}
                title={t('Copy to clipboard')}
                borderless
                size="sm"
                onClick={handleCopyIssueUrl}
                aria-label={t('Copy to clipboard')}
              />
            </UrlContainer>
            <div>
              <CheckboxContainer>
                {t('Include Event ID in link')}
                <Checkbox
                  checked={hasEventId}
                  onChange={() => setHasEventId(!hasEventId)}
                />
              </CheckboxContainer>
              <CheckboxContainer>
                {t('Copy as Markdown link')}
                <Checkbox
                  checked={hasMarkdownLink}
                  onChange={() => setHasMarkdownLink(!hasMarkdownLink)}
                />
              </CheckboxContainer>
            </div>
          </IssueLinkWrapper>
          <div>
            <SwitchWrapper>
              <div>
                <Title>{t('Create a public link')}</Title>
                <SubText>
                  {t('Share a link with anyone outside your organization')}
                </SubText>
              </div>
              <Switch
                aria-label={isShared ? t('Unshare') : t('Share')}
                isActive={isShared}
                size="lg"
                toggle={handleShare}
              />
            </SwitchWrapper>
            {(!group || loading) && (
              <LoadingContainer>
                <LoadingIndicator mini />
              </LoadingContainer>
            )}
            {group && !loading && isShared && shareUrl && (
              <UrlContainer>
                <TextContainer>
                  <StyledAutoSelectText ref={urlRef}>{shareUrl}</StyledAutoSelectText>
                </TextContainer>

                <ClipboardButton
                  text={shareUrl}
                  title={t('Copy to clipboard')}
                  borderless
                  size="sm"
                  onClick={handleCopy}
                  aria-label={t('Copy to clipboard')}
                />

                <ReshareButton
                  title={t('Generate new URL. Invalidates previous URL')}
                  aria-label={t('Generate new URL')}
                  borderless
                  size="sm"
                  icon={<IconRefresh />}
                  onClick={() => handleShare(null, true)}
                />
              </UrlContainer>
            )}
          </div>
        </ModalContent>
      </Body>
    </Fragment>
  );
}

/**
 * min-height reduces layout shift when switching on and off
 */
const ModalContent = styled('div')`
  display: flex;
  gap: ${space(2)};
  flex-direction: column;
  min-height: 175px;
`;

const SwitchWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(2)};
  margin-bottom: ${space(1)};
`;

const IssueLinkWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${space(1)};
`;

const Title = styled('div')`
  padding-right: ${space(4)};
  white-space: nowrap;
`;

const SubText = styled('p')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const LoadingContainer = styled('div')`
  display: flex;
  justify-content: center;
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

const ClipboardButton = styled(CopyToClipboardButton)`
  border-radius: 0;
  border-right: 1px solid ${p => p.theme.border};
  height: 100%;
  flex-shrink: 0;
  margin: 0;

  &:hover {
    border-right: 1px solid ${p => p.theme.border};
  }
`;

const ReshareButton = styled(Button)`
  border-radius: 0;
  height: 100%;
  flex-shrink: 0;
`;

const CheckboxContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;
