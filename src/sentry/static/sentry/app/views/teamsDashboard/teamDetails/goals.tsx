import React from 'react';

import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import {Goal} from 'app/types';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Button from 'app/components/button';
import {t} from 'app/locale';
import {IconFlag, IconLab} from 'app/icons';

type Props = {
  goals?: Array<Goal>;
};

const goals: Array<Goal> = [
  {
    id: '1',
    dateCreated: String(new Date()),
    title: 'Finish Goals Page',
    duedate: String(new Date()),
    owner: {
      // @ts-ignore
      user: {
        id: '1',
        name: 'Priscila Oliveira',
        email: 'priscila.oliveira@sentry.io',
      },
      inviteStatus: 'requested_to_join',
    },
  },
];

class Goals extends React.Component<Props> {
  render() {
    return (
      <Panel>
        <PanelHeader hasButtons>
          {t('Goals')}
          <Button size="small" icon={<IconLab />}>
            {t('Add Goal')}
          </Button>
        </PanelHeader>
        <PanelBody>
          {goals.length > 0 ? (
            goals.map(goal => (
              <PanelItem key={goal.id}>
                <div>{goal.title}</div>
                <div>{goal.duedate}</div>
                <div>{goal.progress}</div>
                <div>{goal.description}</div>
                <div>{goal.owner.name}</div>
              </PanelItem>
            ))
          ) : (
            <EmptyMessage icon={<IconFlag size="xl" />} size="large">
              {t('This team has no goals')}
            </EmptyMessage>
          )}
        </PanelBody>
      </Panel>
    );
  }
}

export default Goals;
