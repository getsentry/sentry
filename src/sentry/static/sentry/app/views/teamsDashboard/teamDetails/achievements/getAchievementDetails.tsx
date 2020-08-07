import React from 'react';

import {t} from 'app/locale';
import {AchievementType} from 'app/types';

import EverythingIsBroke from './badges/everythingIsBroke';
import FirstTransaction from './badges/firstTransaction';
import SentFirstEvent from './badges/sentFirstEvent';
import SentOneMillionErrors from './badges/sentOneMillionErrors';
import YourTeamIsGrowing from './badges/yourTeamIsGrowing';
import TenGBSent from './badges/tenGBSent';
import TransactionsAreAlive from './badges/transactionsAreAlive';
import WeKnewYouCouldDoIt from './badges/weKnewYouCouldDoIt';

function getAchievementDetails(type: AchievementType) {
  switch (type) {
    case 'everything-is-broke':
      return {
        title: t('Everything is broke'),
        img: <EverythingIsBroke />,
      };
    case 'first-transaction':
      return {
        title: t('First transaction'),
        img: <FirstTransaction />,
      };
    case 'sent-first-event':
      return {
        title: t('Sent first event'),
        img: <SentFirstEvent />,
      };
    case 'sent-one-million-errors':
      return {
        title: t('Sent 1 million errors'),
        img: <SentOneMillionErrors />,
      };
    case 'team-is-growing':
      return {
        title: t('Your team is growing!'),
        img: <YourTeamIsGrowing />,
      };
    case 'ten-gb-sent':
      return {
        title: t('10 gb Sent'),
        img: <TenGBSent />,
      };
    case 'transactions-are-alive':
      return {
        title: t('Transactions are alive!'),
        img: <TransactionsAreAlive />,
      };
    case 'we-knew-you-could-do-it':
      return {
        title: t('We knew you could do it!'),
        img: <WeKnewYouCouldDoIt />,
      };
    default:
      return {};
  }
}

export default getAchievementDetails;
