import {Fragment, useState} from 'react';
import {useMutation} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {toast} from '@sentry/scraps/toast';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

import {PageHeader} from 'admin/components/pageHeader';

import {SearchContainer} from './debuggingTools';

function ForceAutoAssignment() {
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [groupIds, setGroupIds] = useState('');

  const {mutateAsync: forceAutoAssignment} = useMutation({
    mutationFn: ({
      organizationIdOrSlug,
      groupIdsArray,
    }: {
      groupIdsArray: number[];
      organizationIdOrSlug: string;
    }) =>
      fetchMutation<{updatedGroupIds: number[]}>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/issues/force-auto-assignment/',
          {path: {organizationIdOrSlug}}
        ),
        method: 'PUT',
        data: {group_ids: groupIdsArray},
      }),
  });

  const handleSubmit = async (event: any) => {
    event.preventDefault();
    if (!organizationSlug || !groupIds) {
      toast.error('Requires the organization slug and group list.');
      return;
    }
    const groupIdsArray = groupIds.split(',').map(item => {
      return parseInt(item, 10);
    });

    const response = await forceAutoAssignment({
      organizationIdOrSlug: organizationSlug,
      groupIdsArray,
    });

    const updatedGroupIdsStr = response.updatedGroupIds.join();
    toast.success('Updated groups: ' + updatedGroupIdsStr);
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
          <Button variant="primary" type="submit">
            Submit
          </Button>
        </SearchContainer>
      </form>
    </Fragment>
  );
}

export function PrivateAPIs() {
  return (
    <div>
      <PageHeader title="Private APIs" />
      <h3>Force Auto-Assignment:</h3>
      <ForceAutoAssignment />
    </div>
  );
}
