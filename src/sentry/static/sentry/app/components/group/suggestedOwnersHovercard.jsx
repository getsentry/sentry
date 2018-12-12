import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';
import styled from 'react-emotion';

import {t, tct} from 'app/locale';
import ActorAvatar from 'app/components/actorAvatar';
import Alert from 'app/components/alert';
import Hovercard from 'app/components/hovercard';
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/link';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

export default function SuggestedOwnersHovercard(props) {
  const {actor, commits, rules, children} = props;

  const body = (
    <HovercardBody>
      {commits !== undefined && (
        <React.Fragment>
          <div className="divider">
            <h6>{t('Commits')}</h6>
          </div>
          <SuggestionReason>{t('Suggested based on suspect commits')}</SuggestionReason>
          <ul>
            {commits.slice(0, 6).map(({message, dateCreated}, i) => (
              <SuggestedItem key={i}>
                <CommitIcon />
                <CommitMessage message={message} date={dateCreated} />
              </SuggestedItem>
            ))}
          </ul>
        </React.Fragment>
      )}
      {rules !== undefined && (
        <React.Fragment>
          <div className="divider">
            <h6>{t('Ownership Rules')}</h6>
          </div>
          <SuggestionReason>
            {t('Suggested based on Project Ownership settings')}
          </SuggestionReason>
          <ul>
            {rules.map(([type, matched], i) => (
              <SuggestedItem key={i}>
                <OwnershipTag>{type}</OwnershipTag>
                <OwnershipValue>{matched}</OwnershipValue>
              </SuggestedItem>
            ))}
          </ul>
        </React.Fragment>
      )}
    </HovercardBody>
  );

  const header = (
    <React.Fragment>
      <HovercardHeader>
        <HovercardActorAvatar actor={actor} />
        {actor.name || actor.email}
      </HovercardHeader>
      {actor.id === undefined && (
        <StyledAlert icon="icon-warning-sm" type="warning">
          {tct(
            'The email [actorEmail]  has no associated Sentry account. Make sure to link alternative emails in [accountSettings:Account Settings].',
            {
              actorEmail: <strong>{actor.email}</strong>,
              accountSettings: <Link to="/settings/account/emails/" />,
            }
          )}
        </StyledAlert>
      )}
    </React.Fragment>
  );

  return (
    <Hovercard
      key={`${actor.type}:${actor.email}`}
      containerClassName="avatar-grid-item"
      header={header}
      body={body}
    >
      {children}
    </Hovercard>
  );
}

SuggestedOwnersHovercard.propTypes = {
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

const CommitIcon = styled(p => <InlineSvg src="icon-commit" size="16px" {...p} />)`
  margin-right: 4px;
  flex-shrink: 0;
`;

const CommitMessage = styled(({message, date, ...props}) => (
  <div {...props}>
    {message.split('\n')[0]}
    <CommitDate date={date} />
  </div>
))`
  color: ${p => p.theme.gray5};
  font-size: 11px;
  margin-top: 2px;
`;

const CommitDate = styled(({date, ...props}) => (
  <div {...props}>{moment(date).fromNow()}</div>
))`
  margin-top: 4px;
  color: ${p => p.theme.gray2};
`;

const SuggestionReason = styled('div')`
  color: ${p => p.theme.gray2};
  font-size: 11px;
  margin-bottom: 8px;
`;

const SuggestedItem = styled('li')`
  display: flex;
  align-items: flex-start;

  &:not(:last-child) {
    margin-bottom: ${space(1)};
  }
`;

const OwnershipTag = styled('div')`
  background: ${p => p.theme.blueLight};
  color: #fff;
  font-size: 11px;
  padding: 2px 4px;
  margin: 2px 4px 2px 0;
  border-radius: 2px;
  font-weight: bold;
  min-width: 34px;
  text-align: center;
`;

const OwnershipValue = styled('code')`
  word-break: break-all;
  line-height: 1.2;
`;

const HovercardHeader = styled('div')`
  display: flex;
  align-items: center;
`;

const HovercardActorAvatar = styled(p => <ActorAvatar size={20} {...p} />)`
  margin-right: 8px;
`;

const StyledAlert = styled(p => <Alert iconSize={16} {...p} />)`
  margin: 10px -13px -9px;
  border-radius: 0;
  border-color: #ece0b0;
  padding: 10px;
  font-size: 12px;
  font-weight: normal;
  box-shadow: none;
`;

const HovercardBody = styled('div')`
  margin-top: -${space(2)};

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
`;
