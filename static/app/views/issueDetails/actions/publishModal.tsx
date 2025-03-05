import {Fragment, useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {bulkUpdate} from 'sentry/actionCreators/group';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import AutoSelectText from 'sentry/components/autoSelectText';
import {Button} from 'sentry/components/button';
import {Switch} from 'sentry/components/core/switch';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

interface PublishIssueModalProps extends ModalRenderProps {
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

export default function PublishIssueModal({
  Header,
  Body,
  organization,
  projectSlug,
  groupId,
  onToggle,
  closeModal,
}: PublishIssueModalProps) {
  const api = useApi({persistInFlight: true});
  const [loading, setLoading] = useState(false);
  const urlRef = useRef<UrlRef>(null);
  const groups = useLegacyStore(GroupStore);
  const group = (groups as Group[]).find(item => item.id === groupId);
  const isPublished = group?.isPublic;
  const hasStreamlinedUI = useHasStreamlinedUI();
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

  const shareUrl = group?.shareId ? getShareUrl(group) : null;

  const {onClick: handleCopy} = useCopyToClipboard({
    text: shareUrl!,
    onCopy: closeModal,
  });

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Publish Issue')}</h4>
      </Header>
      <Body>
        <ModalContent>
          <SwitchWrapper>
            <div>
              <Title>{t('Create a public link')}</Title>
              <SubText>{t('Share a link with anyone outside your organization')}</SubText>
            </div>
            <Switch
              aria-label={isPublished ? t('Unpublish') : t('Publish')}
              checked={isPublished}
              size="lg"
              onClick={handleShare}
            />
          </SwitchWrapper>
          {(!group || loading) && (
            <LoadingContainer>
              <LoadingIndicator mini />
            </LoadingContainer>
          )}
          {group && !loading && isPublished && shareUrl && (
            <PublishActions>
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
                  onClick={() => handleShare(null, true)}
                  analyticsEventKey="issue_details.publish_issue_modal.generate_new_url"
                  analyticsEventName="Issue Details: Publish Issue Modal Generate New URL"
                />
              </UrlContainer>
              <ButtonContainer>
                <Button
                  priority="primary"
                  onClick={handleCopy}
                  analyticsEventKey="issue_details.publish_issue_modal.copy_link"
                  analyticsEventName="Issue Details: Publish Issue Modal Copy Link"
                  analyticsParams={{
                    streamline: hasStreamlinedUI,
                  }}
                >
                  {t('Copy Link')}
                </Button>
              </ButtonContainer>
            </PublishActions>
          )}
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

const ReshareButton = styled(Button)`
  border-radius: 0;
  height: 100%;
  flex-shrink: 0;
`;

const PublishActions = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const ButtonContainer = styled('div')`
  align-self: flex-end;
`;
