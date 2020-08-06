import React from 'react';

import {PanelTable} from 'app/components/panels';
import {Goal, Member} from 'app/types';
import DateTime from 'app/components/dateTime';
import ProgressRing from 'app/components/progressRing';
import {t} from 'app/locale';

type Props = {
  goals?: Array<Goal>;
};

type State = {
  orgMemberList: Array<Member>;
  isDropdownBusy: boolean;
  query: string;
};

const goals: Array<Goal> = [
  {
    id: '1',
    dateCreated: String(new Date()),
    title: 'Finish Goals Page',
    duedate: String(new Date()),
    progress: 30,
    owner: {
      // @ts-ignore
      user: {
        id: '1',
        name: 'Jane Bloggs',
        email: 'janebloggs@example.com',
      },
      inviteStatus: 'requested_to_join',
    },
  },
];

class Goals extends React.Component<Props, State> {
  render() {
    return (
      <PanelTable
        headers={[
          t('Title'),
          t('Due date'),
          t('Progress'),
          t('Description'),
          t('Created By'),
        ]}
        emptyMessage={t('This team has no goals')}
      >
        {goals.map(goal => (
          <React.Fragment key={goal.id}>
            <div>{goal.title}</div>
            <DateTime date={goal.duedate} shortDate />
            <div>
              <ProgressRing value={goal.progress} size={40} barWidth={6} />
            </div>
            <div>{goal.description || '-'}</div>
            <div>{goal.owner.user.name}</div>
          </React.Fragment>
        ))}
      </PanelTable>
    );
  }
}

export default Goals;
