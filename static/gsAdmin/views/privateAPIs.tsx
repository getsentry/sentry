import {Fragment, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import useApi from 'sentry/utils/useApi';

import PageHeader from 'admin/components/pageHeader';

import {SearchContainer} from './debuggingTools';

function ForceAutoAssignment() {
  const api = useApi();
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [groupIds, setGroupIds] = useState('');

  const handleSubmit = async (event: any) => {
    event.preventDefault();
    if (!organizationSlug || !groupIds) {
      addErrorMessage('Requires the organization slug and group list.');
      return;
    }
    const groupIdsArray = groupIds.split(',').map(item => {
      return parseInt(item, 10);
    });

    const response = await api.requestPromise(
      `/organizations/${organizationSlug}/issues/force-auto-assignment/`,
      {
        method: 'PUT',
        data: {group_ids: groupIdsArray},
      }
    );

    const updatedGroupIdsStr = response.updatedGroupIds.join();
    addSuccessMessage('Updated groups: ' + updatedGroupIdsStr);
  };

  return (
    <Fragment>
      <form onSubmit={handleSubmit}>
        <p>Force auto-assignment for a list of groups for an organization.</p>
        <p>Limitations:</p>
        <ul>
          <li>Length of group ids must be less than or equal to 100</li>
          <li>This API has a ratelimit of 1 request per org per minute</li>
          <li>Groups must have been auto-assigned and then manually assigned</li>
        </ul>
        <SearchContainer>
          <div>Organization Slug:</div>
          <Input
            type="text"
            name="organizaton-slug"
            onChange={e => setOrganizationSlug(e.target.value)}
            value={organizationSlug}
            minLength={1}
            placeholder="sentry"
          />
          <div>List of Group Ids:</div>
          <Input
            type="text"
            name="group-list"
            onChange={e => setGroupIds(e.target.value)}
            value={groupIds}
            minLength={1}
            placeholder="1, 2, 3"
          />
          <Button priority="primary" redesign type="submit">
            Submit
          </Button>
        </SearchContainer>
      </form>
    </Fragment>
  );
}

function PrivateAPIs() {
  return (
    <div>
      <PageHeader title="Private APIs" />
      <h3>Force Auto-Assignment:</h3>
      <ForceAutoAssignment />
    </div>
  );
}

export default PrivateAPIs;
