import {useCallback} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import {LinkButton} from 'sentry/components/button';
import CommitLink from 'sentry/components/commitLink';
import Link from 'sentry/components/links/link';
import PanelItem from 'sentry/components/panels/panelItem';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Commit} from 'sentry/types/integrations';
import {useUser} from 'sentry/utils/useUser';

function formatCommitMessage(message: string | null) {
  if (!message) {
    return t('No message provided');
  }

  return message.split(/\n/)[0];
}

export interface ReleaseCommitProps {
  commit: Commit;
}

export function ReleaseCommit({commit}: ReleaseCommitProps) {
  const user = useUser();

  const handleInviteClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      // Prevent link behavior
      event?.preventDefault();

      if (!commit.author?.email) {
        Sentry.captureException(
          new Error(`Commit author has no email or id, invite flow is broken.`)
        );
        return;
      }

      openInviteMembersModal({
        initialData: [
          {
            emails: new Set([commit.author.email]),
          },
        ],
        source: 'suspect_commit',
      });
    },
    [commit.author]
  );

  const isUser = user?.id === commit.author?.id;

  return (
    <StyledPanelItem key={commit.id} data-test-id="commit-row">
      <CommitContent>
        <Message>{formatCommitMessage(commit.message)}</Message>
        <MetaWrapper>
          <UserAvatar size={16} user={commit.author} />
          <Meta>
            <Tooltip
              title={tct(
                'The email [actorEmail] is not a member of your organization. [inviteUser:Invite] them or link additional emails in [accountSettings:account settings].',
                {
                  actorEmail: <BoldEmail>{commit.author?.email}</BoldEmail>,
                  accountSettings: <StyledLink to="/settings/account/emails/" />,
                  inviteUser: (
                    <StyledLink
                      to=""
                      onClick={handleInviteClick}
                      aria-label={t('Invite user')}
                    />
                  ),
                }
              )}
              disabled={!commit.author || commit.author.id !== undefined}
              overlayStyle={{maxWidth: '350px'}}
              skipWrapper
              isHoverable
            >
              <AuthorWrapper>
                {isUser ? t('You') : commit.author?.name ?? t('Unknown author')}
                {commit.author && commit.author.id === undefined && (
                  <IconQuestion size="xs" />
                )}
              </AuthorWrapper>
            </Tooltip>
            {tct(' committed [commitLink] ', {
              commitLink: (
                <CommitLink
                  inline
                  showIcon={false}
                  commitId={commit.id}
                  repository={commit.repository}
                />
              ),
            })}
            <TimeSince date={commit.dateCreated} tooltipUnderlineColor="background" />
          </Meta>
        </MetaWrapper>
      </CommitContent>

      {commit.pullRequest?.externalUrl && (
        <LinkButton external href={commit.pullRequest.externalUrl}>
          {t('View Pull Request')}
        </LinkButton>
      )}
    </StyledPanelItem>
  );
}

const StyledPanelItem = styled(PanelItem)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(2)};
`;

const BoldEmail = styled('strong')`
  font-weight: bold;
  word-break: break-all;
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.textColor};
  border-bottom: 1px dotted ${p => p.theme.textColor};

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const Message = styled(TextOverflow)`
  font-size: ${p => p.theme.fontSizeLarge};
  line-height: 1.2;
`;

const Meta = styled(TextOverflow)`
  line-height: 1.5;
  margin: 0;
  color: ${p => p.theme.subText};

  a {
    color: ${p => p.theme.subText};
    text-decoration: underline;
    text-decoration-style: dotted;
  }

  a:hover {
    color: ${p => p.theme.textColor};
  }
`;

const CommitContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  ${p => p.theme.overflowEllipsis};
`;

const MetaWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1.2;
`;

const AuthorWrapper = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${space(0.25)};
  color: ${p => p.theme.subText};

  & svg {
    transition: 120ms opacity;
    opacity: 0.6;
  }

  &:has(svg):hover {
    color: ${p => p.theme.textColor};
    & svg {
      opacity: 1;
    }
  }
`;
