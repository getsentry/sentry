import {Fragment, useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {bulkUpdate} from 'sentry/actionCreators/group';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import AutoSelectText from 'sentry/components/autoSelectText';
import {Button} from 'sentry/components/button';
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
import useApi from 'sentry/utils/useApi';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

interface ShareIssueModalProps extends ModalRenderProps {
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

function ShareIssueModal({
  Header,
  Body,
  Footer,
  organization,
  projectSlug,
  groupId,
  onToggle,
  closeModal,
}: ShareIssueModalProps) {
  const api = useApi({persistInFlight: true});
  const [loading, setLoading] = useState(false);
  const urlRef = useRef<UrlRef>(null);
  const groups = useLegacyStore(GroupStore);
  const group = (groups as Group[]).find(item => item.id === groupId);
  const isShared = group?.isPublic;

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
          <SwitchWrapper>
            <div>
              <Title>{t('Create a public link')}</Title>
              <SubText>{t('Share a link with anyone outside your organization')}</SubText>
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
        </ModalContent>
      </Body>
      <Footer>
        {!loading && isShared && shareUrl ? (
          <Button priority="primary" onClick={handleCopy}>
            {t('Copy Link')}
          </Button>
        ) : (
          <Button priority="primary" onClick={closeModal}>
            {t('Close')}
          </Button>
        )}
      </Footer>
    </Fragment>
  );
}

export default ShareIssueModal;

/**
 * min-height reduces layout shift when switching on and off
 */
const ModalContent = styled('div')`
  display: flex;
  gap: ${space(2)};
  flex-direction: column;
  min-height: 100px;
`;

const SwitchWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(2)};
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
