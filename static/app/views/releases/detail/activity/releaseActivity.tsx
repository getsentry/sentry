import {useContext, useEffect} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import GroupStore from 'sentry/stores/groupStore';
import space from 'sentry/styles/space';
import useApiRequests from 'sentry/utils/useApiRequests';
import {useParams} from 'sentry/utils/useParams';

import {ReleaseContext} from '../index';

import {ReleaseActivityItem, ReleaseActivityWaiting} from './releaseActivityItems';
import {ReleaseActivity, ReleaseActivityIssue, ReleaseActivityType} from './types';

export function ReleaseActivityList() {
  const params = useParams();
  const {project} = useContext(ReleaseContext);

  const {data, renderComponent} = useApiRequests<{activities: ReleaseActivity[]}>({
    endpoints: [
      [
        'activities',
        `/projects/${params.orgId}/${project.slug}/releases/${params.release}/activity/`,
      ],
    ],
  });

  useEffect(() => {
    const groups = data.activities
      ?.filter(
        (activity): activity is ReleaseActivityIssue =>
          activity.type === ReleaseActivityType.ISSUE
      )
      .map(activity => activity.data.group);

    // Add groups to the store for displaying via EventOrGroupHeader
    GroupStore.add(groups ?? []);

    return () => {
      GroupStore.reset();
    };
  }, [data.activities]);

  const activities = data.activities ?? [];
  const isFinished = activities.some(
    activity => activity.type === ReleaseActivityType.FINISHED
  );

  return renderComponent(
    <Layout.Body>
      <Layout.Main fullWidth>
        <ActivityList>
          {activities.map((activity, idx) => (
            <ReleaseActivityItem key={idx} activity={activity} />
          ))}
          {isFinished ? null : <ReleaseActivityWaiting />}
        </ActivityList>
      </Layout.Main>
    </Layout.Body>
  );
}

const ActivityList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(4)};
`;
