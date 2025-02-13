import {Fragment, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/alert';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {Button} from 'sentry/components/button';
import CommitLink from 'sentry/components/commitLink';
import {Divider, Hovercard} from 'sentry/components/hovercard';
import Link from 'sentry/components/links/link';
import Version from 'sentry/components/version';
import {IconCommit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Actor} from 'sentry/types/core';
import type {Commit} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Release} from 'sentry/types/release';
import {defined} from 'sentry/utils';

type Props = {
  /**
   * The suggested actor.
   */
  actor: Actor;
  /**
   * Children are required, as they are passed to the hovercard component, without it,
   * we will not be able to trigger any hovercard actions
   */
  children: React.ReactNode;
  organization: Organization;
  /**
   * The list of commits the actor is suggested for. May be left blank if the
   * actor is not suggested for commits.
   */
  commits?: Commit[];
  /**
   * Used to pre-select release project
   */
  projectId?: string;
  release?: Release;
  /**
   * The list of ownership rules the actor is suggested for. May be left blank
   * if the actor is not suggested based on ownership rules.
   */
  rules?: any[] | null;
};

function SuggestedOwnerHovercard(props: Props) {
  const theme = useTheme();
  const [commitsExpanded, setCommitsExpanded] = useState<boolean>(false);
  const [rulesExpanded, setRulesExpanded] = useState<boolean>(false);

  const {organization, actor, commits, rules, release, projectId} = props;
  const modalData = {
    initialData: [
      {
        emails: actor.email ? new Set([actor.email]) : new Set([]),
      },
    ],
    source: 'suggested_assignees',
  };

  const tagColors = useMemo(
    () =>
      ({
        url: theme.green200,
        path: theme.purple300,
        tag: theme.blue300,
        codeowners: theme.pink300,
        release: theme.pink200,
      }) as const,
    [theme]
  );

  return (
    <StyledHovercard
      skipWrapper
      header={
        <Fragment>
          <HovercardHeader>
            <ActorAvatar size={20} hasTooltip={false} actor={actor} />
            {actor.name || actor.email}
          </HovercardHeader>
          {actor.id === undefined && (
            <EmailAlert margin={false} type="warning" showIcon>
              {tct(
                'The email [actorEmail] is not a member of your organization. [inviteUser:Invite] them or link additional emails in [accountSettings:account settings].',
                {
                  actorEmail: <strong>{actor.email}</strong>,
                  accountSettings: <Link to="/settings/account/emails/" />,
                  inviteUser: <a onClick={() => openInviteMembersModal(modalData)} />,
                }
              )}
            </EmailAlert>
          )}
        </Fragment>
      }
      body={
        <HovercardBody>
          {commits !== undefined && !release && (
            <Fragment>
              <Divider>
                <h6>{t('Commits')}</h6>
              </Divider>
              <div>
                {commits
                  .slice(0, commitsExpanded ? commits.length : 3)
                  .map(({message, dateCreated}, i) => (
                    <CommitReasonItem key={i}>
                      <CommitIcon />
                      <CommitMessage message={message ?? undefined} date={dateCreated} />
                    </CommitReasonItem>
                  ))}
              </div>
              {commits.length > 3 && !commitsExpanded ? (
                <ViewMoreButton
                  priority="link"
                  size="zero"
                  onClick={() => setCommitsExpanded(true)}
                >
                  {t('View more')}
                </ViewMoreButton>
              ) : null}
            </Fragment>
          )}
          {commits !== undefined && release && (
            <Fragment>
              <Divider>
                <h6>{t('Suspect Release')}</h6>
              </Divider>
              <div>
                <CommitReasonItem>
                  <OwnershipTag tagType="release" tagColors={tagColors} />
                  <ReleaseValue>
                    {tct('[actor] [verb] [commits] in [release]', {
                      actor: actor.name,
                      verb: commits.length > 1 ? t('made') : t('last committed'),
                      commits:
                        commits.length > 1 ? (
                          // Link to release commits
                          <Link
                            to={{
                              pathname: `/organizations/${
                                organization?.slug
                              }/releases/${encodeURIComponent(release.version)}/commits/`,
                              query: {project: projectId},
                            }}
                          >
                            {t('%s commits', commits.length)}
                          </Link>
                        ) : (
                          <CommitLink
                            inline
                            showIcon={false}
                            commitId={commits[0]!.id}
                            repository={commits[0]!.repository}
                          />
                        ),
                      release: (
                        <Version version={release.version} projectId={projectId} />
                      ),
                    })}
                  </ReleaseValue>
                </CommitReasonItem>
              </div>
            </Fragment>
          )}
          {defined(rules) && (
            <Fragment>
              <Divider>
                <h6>{t('Matching Ownership Rules')}</h6>
              </Divider>
              <div>
                {rules
                  .slice(0, rulesExpanded ? rules.length : 3)
                  .map(([type, matched], i) => (
                    <RuleReasonItem key={i}>
                      <OwnershipTag tagType={type} tagColors={tagColors} />
                      <OwnershipValue>{matched}</OwnershipValue>
                    </RuleReasonItem>
                  ))}
              </div>
              {rules.length > 3 && !rulesExpanded ? (
                <ViewMoreButton
                  priority="link"
                  size="zero"
                  onClick={() => setRulesExpanded(true)}
                >
                  {t('View more')}
                </ViewMoreButton>
              ) : null}
            </Fragment>
          )}
        </HovercardBody>
      }
      {...props}
    />
  );
}

const StyledHovercard = styled(Hovercard)`
  width: 400px;
`;

const CommitIcon = styled(IconCommit)`
  margin-right: ${space(0.5)};
  flex-shrink: 0;
`;

const CommitMessage = styled(({message = '', date, ...props}: any) => (
  <div {...props}>
    {message.split('\n')[0]}
    <CommitDate date={date} />
  </div>
))`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  margin-top: ${space(0.25)};
  hyphens: auto;
`;

const CommitDate = styled(({date, ...props}: any) => (
  <div {...props}>{moment(date).fromNow()}</div>
))`
  margin-top: ${space(0.5)};
  color: ${p => p.theme.gray300};
`;

const CommitReasonItem = styled('div')`
  display: flex;
  align-items: flex-start;
  gap: ${space(1)};
`;

const RuleReasonItem = styled('div')`
  display: flex;
  align-items: flex-start;
  gap: ${space(1)};
`;

const OwnershipTag = styled(
  ({tagType, ...props}: {tagColors: Record<string, string>; tagType: string}) => (
    <div {...props}>{tagType}</div>
  )
)`
  background: ${p =>
    p.tagColors[
      p.tagType.indexOf('tags') === -1 ? (p.tagType as keyof typeof p.tagColors) : 'tag'
    ]};
  color: ${p => p.theme.white};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: ${space(0.25)} ${space(0.5)};
  margin: ${space(0.25)} ${space(0.5)} ${space(0.25)} 0;
  border-radius: 2px;
  font-weight: ${p => p.theme.fontWeightBold};
  text-align: center;
`;

const ViewMoreButton = styled(Button)`
  border: none;
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: ${space(0.25)} ${space(0.5)};
  margin: ${space(1)} ${space(0.25)} ${space(0.25)} 0;
  width: 100%;
  min-width: 34px;
`;

const OwnershipValue = styled('code')`
  word-break: break-all;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  margin-top: ${space(0.25)};
`;

const ReleaseValue = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin-top: ${space(0.5)};
`;

const EmailAlert = styled(Alert)`
  margin: 10px -13px -13px;
  border-radius: 0;
  border-color: #ece0b0;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightNormal};
  box-shadow: none;
`;

const HovercardHeader = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const HovercardBody = styled('div')`
  margin-top: -${space(2)};
`;

export default SuggestedOwnerHovercard;
