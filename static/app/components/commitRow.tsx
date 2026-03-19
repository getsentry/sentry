import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {CommitLink} from 'sentry/components/commitLink';
import {TextOverflow} from 'sentry/components/textOverflow';
import {TimeSince} from 'sentry/components/timeSince';
import {Version} from 'sentry/components/version';
import {VersionHoverCard} from 'sentry/components/versionHoverCard';
import {IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Commit} from 'sentry/types/integrations';
import type {AvatarProject} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {Divider} from 'sentry/views/issueDetails/divider';

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

  return (
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
        {customAvatar ? (
          customAvatar
        ) : commit.author ? (
          <UserAvatar size={16} user={commit.author} />
        ) : null}
        <Meta>
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
  );
}

const BoldEmail = styled('strong')`
  font-weight: bold;
  word-break: break-all;
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.tokens.content.primary};
  border-bottom: 1px dotted currentColor;

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const Message = styled(TextOverflow)`
  font-size: ${p => p.theme.font.size.lg};
  line-height: 1.2;
`;

const Meta = styled(TextOverflow)`
  font-size: ${p => p.theme.font.size.md};
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
  gap: ${p => p.theme.space.xs};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  padding-top: ${p => p.theme.space['2xs']};
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
  gap: ${p => p.theme.space['2xs']};
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
