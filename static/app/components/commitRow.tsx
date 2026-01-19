import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Stack} from '@sentry/scraps/layout';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import CommitLink from 'sentry/components/commitLink';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {Hovercard} from 'sentry/components/hovercard';
import PanelItem from 'sentry/components/panels/panelItem';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {IconQuestion, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Commit} from 'sentry/types/integrations';
import type {AvatarProject} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {Divider} from 'sentry/views/issueDetails/divider';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

export function formatCommitMessage(message: string | null) {
  if (!message) {
    return t('No message provided');
  }

  return message.split(/\n/)[0];
}

export interface CommitRowProps {
  commit: Commit;
  customAvatar?: React.ReactNode;
  onCommitClick?: (commit: Commit) => void;
  onPullRequestClick?: () => void;
  project?: AvatarProject;
}

function CommitRow({
  commit,
  customAvatar,
  onPullRequestClick,
  onCommitClick,
  project,
}: CommitRowProps) {
  const user = useUser();
  const hasStreamlinedUI = useHasStreamlinedUI();
  const organization = useOrganization();
  const handleInviteClick = useCallback(() => {
    if (!commit.author?.email) {
      Sentry.captureException(
        new Error(`Commit author has no email or id, invite flow is broken.`)
      );
      return;
    }

    trackAnalytics('issue_details.suspect_commits.missing_user', {
      organization,
      link: 'invite_user',
    });

    openInviteMembersModal({
      initialData: [
        {
          emails: new Set([commit.author.email]),
        },
      ],
      source: 'suspect_commit',
    });
  }, [commit.author, organization]);

  const isUser = user?.id === commit.author?.id;

  const firstRelease = commit.releases?.[0];

  return hasStreamlinedUI ? (
    <Stack padding="0 lg lg" data-test-id="commit-row">
      {commit.pullRequest?.externalUrl ? (
        <StyledExternalLink
          href={commit.pullRequest?.externalUrl}
          onClick={onPullRequestClick}
        >
          <Message>{formatCommitMessage(commit.message)}</Message>
        </StyledExternalLink>
      ) : (
        <Message>{formatCommitMessage(commit.message)}</Message>
      )}
      <MetaWrapper>
        {customAvatar ? customAvatar : <UserAvatar size={16} user={commit.author} />}
        <Meta hasStreamlinedUI>
          <Tooltip
            title={tct(
              'The email [actorEmail] is not a member of your organization. [inviteUser:Invite] them or link additional emails in [accountSettings:account settings].',
              {
                actorEmail: <BoldEmail>{commit.author?.email}</BoldEmail>,
                accountSettings: (
                  <StyledLink
                    to="/settings/account/emails/"
                    onClick={() =>
                      trackAnalytics('issue_details.suspect_commits.missing_user', {
                        organization,
                        link: 'account_settings',
                      })
                    }
                  />
                ),
                inviteUser: <StyledLink to="" onClick={handleInviteClick} />,
              }
            )}
            disabled={!commit.author || commit.author.id !== undefined}
            overlayStyle={{maxWidth: '350px'}}
            skipWrapper
            isHoverable
          >
            <AuthorWrapper>
              {isUser ? t('You') : (commit.author?.name ?? t('Unknown author'))}
              {commit.author && commit.author.id === undefined && (
                <IconQuestion size="xs" />
              )}
            </AuthorWrapper>
          </Tooltip>
          {tct(' committed [commitLink]', {
            commitLink: (
              <CommitLink
                inline
                showIcon={false}
                commitId={commit.id}
                repository={commit.repository}
                onClick={onCommitClick ? () => onCommitClick(commit) : undefined}
              />
            ),
          })}{' '}
          <TimeSince date={commit.dateCreated} disabledAbsoluteTooltip />
        </Meta>
        {project && firstRelease && (
          <Fragment>
            <Divider />
            {tct('First deployed in release [release]', {
              release: (
                <VersionHoverCard
                  organization={organization}
                  projectSlug={project.slug}
                  releaseVersion={firstRelease.version}
                >
                  <span>
                    <Version
                      version={firstRelease.version}
                      projectId={project.id?.toString()}
                    />
                  </span>
                </VersionHoverCard>
              ),
            })}
          </Fragment>
        )}
      </MetaWrapper>
    </Stack>
  ) : (
    <StyledPanelItem key={commit.id} data-test-id="commit-row">
      {customAvatar ? (
        customAvatar
      ) : commit.author && commit.author.id === undefined ? (
        <AvatarWrapper>
          <Hovercard
            skipWrapper
            body={
              <EmailWarning>
                {tct(
                  'The email [actorEmail] is not a member of your organization. [inviteUser:Invite] them or link additional emails in [accountSettings:account settings].',
                  {
                    actorEmail: <strong>{commit.author.email}</strong>,
                    accountSettings: (
                      <StyledLink
                        to="/settings/account/emails/"
                        onClick={() =>
                          trackAnalytics('issue_details.suspect_commits.missing_user', {
                            organization,
                            link: 'account_settings',
                          })
                        }
                      />
                    ),
                    inviteUser: <StyledLink to="" onClick={handleInviteClick} />,
                  }
                )}
              </EmailWarning>
            }
          >
            <UserAvatar size={36} user={commit.author} />
            <EmailWarningIcon data-test-id="email-warning">
              <IconWarning size="xs" />
            </EmailWarningIcon>
          </Hovercard>
        </AvatarWrapper>
      ) : (
        <div>
          <UserAvatar size={36} user={commit.author} />
        </div>
      )}

      <CommitMessage>
        <Message>{formatCommitMessage(commit.message)}</Message>
        <Meta>
          {tct('[author] committed [commitLink] \u2022 [date]', {
            author: (
              <strong>
                {isUser ? t('You') : (commit.author?.name ?? t('Unknown author'))}
              </strong>
            ),
            commitLink: (
              <CommitLink
                inline
                showIcon={false}
                commitId={commit.id}
                repository={commit.repository}
                onClick={onCommitClick ? () => onCommitClick(commit) : undefined}
              />
            ),
            date: (
              <TimeSince
                tooltipSuffix={commit.suspectCommitType}
                date={commit.dateCreated}
              />
            ),
          })}
        </Meta>
      </CommitMessage>

      {commit.pullRequest?.externalUrl && (
        <LinkButton
          external
          href={commit.pullRequest.externalUrl}
          onClick={onPullRequestClick}
        >
          {t('View Pull Request')}
        </LinkButton>
      )}
    </StyledPanelItem>
  );
}

const StyledPanelItem = styled(PanelItem)`
  display: flex;
  align-items: center;
  gap: ${space(2)};
`;

const AvatarWrapper = styled('div')`
  position: relative;
`;

const EmailWarning = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.4;
  margin: -4px;
`;

const BoldEmail = styled('strong')`
  font-weight: bold;
  word-break: break-all;
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.tokens.content.primary};
  border-bottom: 1px dotted ${p => p.theme.tokens.content.primary};

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const EmailWarningIcon = styled('span')`
  position: absolute;
  bottom: -6px;
  right: -7px;
  line-height: 12px;
  border-radius: 50%;
  border: 1px solid ${p => p.theme.tokens.background.primary};
  background: ${p => p.theme.colors.yellow200};
  padding: 1px 2px 3px 2px;
`;

const CommitMessage = styled('div')`
  flex: 1;
  flex-direction: column;
  min-width: 0;
  margin-right: ${space(2)};
`;

const Message = styled(TextOverflow)`
  font-size: ${p => p.theme.fontSize.lg};
  line-height: 1.2;
`;

const Meta = styled(TextOverflow)<{hasStreamlinedUI?: boolean}>`
  font-size: ${p => (p.hasStreamlinedUI ? p.theme.fontSize.md : '13px')};
  line-height: 1.5;
  margin: 0;
  color: ${p => p.theme.tokens.content.secondary};

  a {
    color: ${p => p.theme.tokens.content.secondary};
    text-decoration: underline;
    text-decoration-style: dotted;
  }

  a:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const MetaWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.md};
  padding-top: ${space(0.25)};
`;

const StyledExternalLink = styled(ExternalLink)`
  color: ${p => p.theme.tokens.content.primary};
  text-decoration: underline;
  text-decoration-color: ${p => p.theme.colors.gray200};

  :hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const AuthorWrapper = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${space(0.25)};
  color: ${p => p.theme.tokens.content.secondary};

  & svg {
    transition: 120ms opacity;
    opacity: 0.6;
  }

  &:has(svg):hover {
    color: ${p => p.theme.tokens.content.primary};
    & svg {
      opacity: 1;
    }
  }
`;

export {CommitRow};
