import {ComponentProps, Fragment} from 'react';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import BaseBadge from 'sentry/components/idBadge/baseBadge';
import Placeholder from 'sentry/components/placeholder';
import ReplaysFeatureBadge from 'sentry/components/replays/replaysFeatureBadge';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {getShortEventId} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  orgSlug: string;
  replayRecord: ReplayRecord | undefined;
};

function DetailsPageBreadcrumbs({orgSlug, replayRecord}: Props) {
  const location = useLocation();
  const eventView = EventView.fromLocation(location);

  const {projects} = useProjects();
  const project = projects.find(p => p.id === replayRecord?.project_id);

  const labelTitle = replayRecord ? (
    <Fragment>
      {getShortEventId(replayRecord?.id)}
      <ReplaysFeatureBadge />
    </Fragment>
  ) : (
    <HeaderPlaceholder width="500px" height="24px" />
  );

  return (
    <Breadcrumbs
      crumbs={[
        {
          to: {
            pathname: `/organizations/${orgSlug}/replays/`,
            query: eventView.generateQueryStringObject(),
          },
          label: t('Session Replay'),
        },
        {
          label: (
            <Fragment>
              {<BaseBadge displayName={labelTitle} project={project} avatarSize={16} />}
            </Fragment>
          ),
        },
      ]}
    />
  );
}

const HeaderPlaceholder = styled((props: ComponentProps<typeof Placeholder>) => (
  <Placeholder width="100%" height="19px" {...props} />
))`
  background-color: ${p => p.theme.background};
`;

export default DetailsPageBreadcrumbs;
