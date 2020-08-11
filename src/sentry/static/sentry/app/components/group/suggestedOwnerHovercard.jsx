import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';
import styled from '@emotion/styled';

import {t, tct} from 'app/locale';
import {openInviteMembersModal} from 'app/actionCreators/modal';
import ActorAvatar from 'app/components/avatar/actorAvatar';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import Hovercard from 'app/components/hovercard';
import {IconCommit, IconWarning} from 'app/icons';
import Link from 'app/components/links/link';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

class SuggestedOwnerHovercard extends React.Component {
  static propTypes = {
    /**
     * The suggested actor.
     */
    actor: PropTypes.oneOfType([
      // eslint-disable-next-line react/no-typos
      SentryTypes.User,
      // Sentry user which has *not* been expanded
      PropTypes.shape({
        email: PropTypes.string.isRequired,
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
      }),
      // Unidentifier user (from commits)
      PropTypes.shape({
        email: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
      }),
      // Sentry team
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
      }),
    ]),

    /**
     * The list of commits the actor is suggested for. May be left blank if the
     * actor is not suggested for commits.
     */
    commits: PropTypes.arrayOf(
      PropTypes.shape({
        message: PropTypes.string.isRequired,
        dateCreated: PropTypes.string.isRequired,
      })
    ),

    /**
     * The list of ownership rules the actor is suggested for. Maybe left blank
     * if the actor is not suggested based on ownership rules.
     */
    rules: PropTypes.arrayOf(PropTypes.array),
  };

  state = {
    commitsExpanded: false,
    rulesExpanded: false,
  };

  render() {
    const {actor, commits, rules, ...props} = this.props;

    return (
      <Hovercard
        header={
          <React.Fragment>
            <HovercardHeader>
              <HovercardActorAvatar actor={actor} />
              {actor.name || actor.email}
            </HovercardHeader>
            {actor.id === undefined && (
              <EmailAlert icon={<IconWarning size="xs" />} type="warning">
                {tct(
                  'The email [actorEmail] is not a member of your organization. [inviteUser:Invite] them or link additional emails in [accountSettings:account settings].',
                  {
                    actorEmail: <strong>{actor.email}</strong>,
                    accountSettings: <Link to="/settings/account/emails/" />,
                    inviteUser: (
                      <a
                        onClick={() =>
                          openInviteMembersModal({
                            initialData: [
                              {
                                emails: new Set([actor.email]),
                              },
                            ],
                            source: 'suggested_assignees',
                          })
                        }
                      />
                    ),
                  }
                )}
              </EmailAlert>
            )}
          </React.Fragment>
        }
        body={
          <HovercardBody>
            {commits !== undefined && (
              <React.Fragment>
                <div className="divider">
                  <h6>{t('Commits')}</h6>
                </div>
                <div>
                  {commits
                    .slice(0, this.state.commitsExpanded ? commits.length : 3)
                    .map(({message, dateCreated}, i) => (
                      <CommitReasonItem key={i}>
                        <CommitIcon />
                        <CommitMessage message={message} date={dateCreated} />
                      </CommitReasonItem>
                    ))}
                </div>
                {commits.length > 3 && !this.state.commitsExpanded ? (
                  <ViewMoreButton
                    onClick={() => this.setState({commitsExpanded: true})}
                  />
                ) : null}
              </React.Fragment>
            )}
            {rules !== undefined && (
              <React.Fragment>
                <div className="divider">
                  <h6>{t('Matching Ownership Rules')}</h6>
                </div>
                <div>
                  {rules
                    .slice(0, this.state.rulesExpanded ? rules.length : 3)
                    .map(([type, matched], i) => (
                      <RuleReasonItem key={i}>
                        <OwnershipTag tagType={type} />
                        <OwnershipValue>{matched}</OwnershipValue>
                      </RuleReasonItem>
                    ))}
                </div>
                {rules.length > 3 && !this.state.rulesExpanded ? (
                  <ViewMoreButton onClick={() => this.setState({rulesExpanded: true})} />
                ) : null}
              </React.Fragment>
            )}
          </HovercardBody>
        }
        {...props}
      />
    );
  }
}

const tagColors = {
  url: theme.green300,
  path: theme.purple400,
  tag: theme.blue300,
};

const CommitIcon = styled(p => <IconCommit {...p} />)`
  margin-right: ${space(0.5)};
  flex-shrink: 0;
`;

const CommitMessage = styled(({message = '', date, ...props}) => (
  <div {...props}>
    {message.split('\n')[0]}
    <CommitDate date={date} />
  </div>
))`
  color: ${p => p.theme.gray800};
  font-size: 11px;
  margin-top: ${space(0.25)};
  hyphens: auto;
`;

const CommitDate = styled(({date, ...props}) => (
  <div {...props}>{moment(date).fromNow()}</div>
))`
  margin-top: ${space(0.5)};
  color: ${p => p.theme.gray500};
`;

const CommitReasonItem = styled('div')`
  display: flex;
  align-items: flex-start;

  &:not(:last-child) {
    margin-bottom: ${space(1)};
  }
`;

const RuleReasonItem = styled('code')`
  display: flex;
  align-items: flex-start;

  &:not(:last-child) {
    margin-bottom: ${space(1)};
  }
`;

const OwnershipTag = styled(({tagType, ...props}) => <div {...props}>{tagType}</div>)`
  background: ${p => tagColors[p.tagType.indexOf('tags') === -1 ? p.tagType : 'tag']};
  color: #fff;
  font-size: 11px;
  padding: ${space(0.25)} ${space(0.5)};
  margin: ${space(0.25)} ${space(0.5)} ${space(0.25)} 0;
  border-radius: 2px;
  font-weight: bold;
  min-width: 34px;
  text-align: center;
`;

const ViewMoreButton = styled(p => (
  <Button {...p} priority="link" size="zero">
    {t('View more')}
  </Button>
))`
  border: none;
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: ${space(0.25)} ${space(0.5)};
  margin: ${space(1)} ${space(0.25)} ${space(0.25)} 0;
  width: 100%;
  min-width: 34px;
`;

const OwnershipValue = styled('code')`
  word-break: break-all;
  line-height: 1.2;
`;

const EmailAlert = styled(p => <Alert iconSize="16px" {...p} />)`
  margin: 10px -13px -13px;
  border-radius: 0;
  border-color: #ece0b0;
  padding: 10px;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: normal;
  box-shadow: none;
`;

const HovercardHeader = styled('div')`
  display: flex;
  align-items: center;
`;

const HovercardActorAvatar = styled(p => (
  <ActorAvatar size={20} hasTooltip={false} {...p} />
))`
  margin-right: ${space(1)};
`;

const HovercardBody = styled('div')`
  margin-top: -${space(2)};
`;

export default SuggestedOwnerHovercard;
