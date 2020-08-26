import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import LoadingIndicator from 'app/components/loadingIndicator';
import {ActionItem} from 'app/views/eventsV2/table/cellAction';

import KeyTransactionQuery from './keyTransactionQuery';

type KeyTransactionActionProps = {
  projectID: number;
  organization: Organization;
  transactionName: string;
};

function KeyTransactionAction(props: KeyTransactionActionProps) {
  const {projectID, organization, transactionName, ...rest} = props;
  return (
    <KeyTransactionQuery
      projectID={projectID}
      organization={organization}
      transactionName={transactionName}
    >
      {({isLoading, error, isKeyTransaction, toggleKeyTransaction}) => {
        return (
          <ActionItem
            disabled={isLoading || error !== null}
            onClick={toggleKeyTransaction}
            {...rest}
          >
            {isLoading ? (
              <StyledLoadingIndicator size={12} />
            ) : isKeyTransaction ? (
              t('Unmark as key transaction')
            ) : (
              t('Mark as key transaction')
            )}
          </ActionItem>
        );
      }}
    </KeyTransactionQuery>
  );
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  display: flex;
  align-items: center;
  height: ${space(2)};
  margin: 0;
`;

export default KeyTransactionAction;
