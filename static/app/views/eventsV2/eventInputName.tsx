import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import EditableText from 'app/components/editableText';
import {Title} from 'app/components/layouts/thirds';
import {t} from 'app/locale';
import {Organization, SavedQuery} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';

import {handleUpdateQueryName} from './savedQuery/utils';

type Props = {
  api: Client;
  organization: Organization;
  eventView: EventView;
  savedQuery?: SavedQuery;
};

const NAME_DEFAULT = t('Untitled query');

/**
 * Allows user to edit the name of the query.
 * By pressing Enter or clicking outside the component, the changes will be saved, if valid.
 */
function EventInputName({api, organization, eventView, savedQuery}: Props) {
  function handleChange(nextQueryName: string) {
    // Do not update automatically if
    // 1) It is a new query
    // 2) The new name is same as the old name
    if (!savedQuery || savedQuery.name === nextQueryName) {
      return;
    }

    // This ensures that we are updating SavedQuery.name only.
    // Changes on QueryBuilder table will not be saved.
    const nextEventView = EventView.fromSavedQuery({
      ...savedQuery,
      name: nextQueryName,
    });

    handleUpdateQueryName(api, organization, nextEventView).then(
      (_updatedQuery: SavedQuery) => {
        // The current eventview may have changes that are not explicitly saved.
        // So, we just preserve them and change its name
        const renamedEventView = eventView.clone();
        renamedEventView.name = nextQueryName;

        browserHistory.push(renamedEventView.getResultsViewUrlTarget(organization.slug));
      }
    );
  }

  return (
    <StyledTitle>
      <StyledEditableText
        name="discover2-query-name"
        value={eventView.name || NAME_DEFAULT}
        onChange={handleChange}
        errorMessage={t('Please set a name for this query')}
      />
    </StyledTitle>
  );
}

export default withApi(EventInputName);

const StyledTitle = styled(Title)`
  margin-left: -22px;
  position: relative;
  height: 40px;
`;

const StyledEditableText = styled(EditableText)`
  position: absolute;
  width: calc(100% + 10px);
`;
