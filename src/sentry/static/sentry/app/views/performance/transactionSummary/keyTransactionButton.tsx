import React from 'react';

import Button from 'app/components/button';
import {IconStar} from 'app/icons';
import {t} from 'app/locale';
import EventView from 'app/utils/discover/eventView';
import {Organization} from 'app/types';

import KeyTransactionQuery from '../keyTransactionQuery';

type Props = {
  eventView: EventView;
  organization: Organization;
  transactionName: string;
};

function KeyTransactionButton(props: Props) {
  const {eventView, organization, transactionName} = props;
  const projects = eventView.project as number[];

  if (projects.length !== 1) {
    return null;
  }

  const projectID = projects[0];

  return (
    <KeyTransactionQuery
      projectID={projectID}
      organization={organization}
      transactionName={transactionName}
    >
      {({isLoading, error, isKeyTransaction, toggleKeyTransaction}) => {
        if (isLoading || error !== null) {
          return null;
        }

        return (
          <Button
            icon={
              <IconStar
                size="xs"
                color={isKeyTransaction ? 'yellow500' : 'gray500'}
                isSolid={!!isKeyTransaction}
              />
            }
            onClick={toggleKeyTransaction}
          >
            {t('Key Transaction')}
          </Button>
        );
      }}
    </KeyTransactionQuery>
  );
}

export default KeyTransactionButton;
