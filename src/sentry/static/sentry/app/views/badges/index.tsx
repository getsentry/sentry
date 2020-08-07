import styled from '@emotion/styled';
import React from 'react';
import DocumentTitle from 'react-document-title';
import moment from 'moment';
import {css} from '@emotion/core';
import {observable} from 'mobx';
import {observer} from 'mobx-react';

import {t} from 'app/locale';
import {Organization, Badge} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import PageHeading from 'app/components/pageHeading';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import Card from 'app/components/card';
import {openBadgeModal} from 'app/actionCreators/modal';

import firstTransaction from './icons/firstTransaction';
import transactionsLive from './icons/transactionsLive';
import bigBoiAttachments from './icons/bigBoiAttachments';
import yourCommitBrokeShit from './icons/yourCommitBrokeShit';
import errorSent1000 from './icons/errorSent1000';
import onboarding from './icons/onboarding';
import firstAttachment from './icons/firstAttachment';
import growTeam from './icons/growTeam';
import firstError from './icons/firstError';
import Locked from './icons/locked';

type Props = {
  organization: Organization;
};

const BADGES: Badge[] = observable.array([
  {
    id: 'firstError',
    icon: firstError,
    title: 'Squash Bugs',
    flavor: 'Cheers to your first error, and many more to come',
    description: 'Send your first error to unlock this badge',
    dateEarned: new Date(),
    unlocked: false,
  },
  {
    id: 'firstTransaction',
    icon: firstTransaction,
    title: 'Speed Mode, Activated!',
    flavor: "You're on your way to mastering the skill of speed",
    description: 'Send your first transaction to unlock this badge',
    dateEarned: new Date(),
    unlocked: false,
  },
  {
    id: 'firstAttachment',
    icon: firstAttachment,
    title: 'Files, served',
    flavor: "They say don't get attached, but we just had to give you this badge",
    description: 'Upload your first attachment to unlock this badge',
    dateEarned: new Date(),
    unlocked: false,
  },
  {
    id: 'transactionsLive',
    icon: transactionsLive,
    title: 'Transaction Live!',
    description: 'Configure transactions using the Sentry SDK to unlock this feature',
    flavor: '',
    dateEarned: new Date(),
    unlocked: false,
  },
  {
    id: 'bigBoiAttachments',
    icon: bigBoiAttachments,
    title: 'Big Boi Attachments',
    flavor: 'A hefty sized file attachment deserves a hefty sized badge',
    description: 'Upload an attachment larger than 200 Megabytes to unlock this badge',
    dateEarned: new Date(),
    unlocked: false,
  },
  {
    id: 'yourCommitBrokeShit',
    icon: yourCommitBrokeShit,
    title: 'Your Commit Broke Sh*t',
    flavor: "Don't worry. That's why you use Sentry. Show that bug loud and proud",
    description:
      'Have an issue created with your account as a suspect commit to unlock this badge',
    dateEarned: new Date(),
    unlocked: false,
  },
  {
    id: 'errorSent1000',
    icon: errorSent1000,
    title: '1k Errors Sent',
    flavor:
      'In the year 1000 the world was one of mystery and magicians, monks, warriors and wandering merchants. That has nothing to do with sending 1000 errors though',
    description: 'Send over 1000 errors to Sentry to unlock this badge',
    dateEarned: new Date(),
    unlocked: false,
  },
  {
    id: 'onboarding',
    icon: onboarding,
    title: 'Onboarding Donezo',
    flavor: "You're onboarding is complete, but a bugsquashers job is never done",
    description: 'Complete the Sentry onboarding to unlock this badge',
    dateEarned: new Date(),
    unlocked: false,
  },
  {
    id: '',
    icon: growTeam,
    title: 'Grow the Team',
    flavor: 'Grow your team to shrink your bug problem',
    description: 'Invite a team membmer to unlock this badge',
    dateEarned: new Date(),
    unlocked: false,
  },
]);

@observer
class Badges extends React.Component<Props> {
  render() {
    return (
      <DocumentTitle title="Badges">
        <PageContent>
          <PageHeading>{t('Badges')}</PageHeading>

          <BadgeList>
            {BADGES.map(badge => (
              <Item key={badge.id} onClick={() => openBadgeModal({badge})}>
                <Icon locked={!badge.unlocked}>
                  <badge.icon />
                </Icon>
                <h2>{badge.title}</h2>
                <DateEarned>
                  {badge.unlocked
                    ? t('Unlocked on %s', moment(badge.dateEarned).format('MMMM Do YY'))
                    : t('Badge Locked')}
                </DateEarned>
                <Indicator>{badge.unlocked ? null : <Locked />}</Indicator>
              </Item>
            ))}
          </BadgeList>
        </PageContent>
      </DocumentTitle>
    );
  }
}

const BadgeList = styled('div')`
  margin-top: ${space(3)};
  display: grid;
  grid-gap: ${space(3)};
  grid-template-columns: repeat(auto-fit, minmax(275px, 1fr));
`;

const Indicator = styled('div')`
  position: absolute;
  top: 10px;
  right: 10px;

  svg {
    width: 60px;
    height: 60px;
  }
`;

const Icon = styled('div')<{locked: boolean}>`
  ${p =>
    p.locked &&
    css`
      filter: grayscale(1);
      opacity: 0.2;
    `};

  transition: opacity 400ms, filter 400ms;
`;

const Item = styled(Card)`
  position: relative;
  padding: ${space(4)};
  align-items: center;
  display: flex;
  flex-direction: column;

  svg {
    height: 160px;
    width: 160px;
  }

  h2 {
    font-size: ${p => p.theme.fontSizeExtraLarge};
    margin-bottom: ${space(1)};
  }
`;

Item.defaultProps = {
  interactive: true,
};

const DateEarned = styled('div')`
  color: ${p => p.theme.gray600};
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default withOrganization(Badges);
