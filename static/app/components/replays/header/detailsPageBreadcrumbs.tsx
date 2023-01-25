import {ComponentProps, Fragment} from 'react';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import Placeholder from 'sentry/components/placeholder';
import ReplaysFeatureBadge from 'sentry/components/replays/replaysFeatureBadge';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  orgSlug: string;
  replayRecord: ReplayRecord | undefined;
};

function DetailsPageBreadcrumbs({orgSlug, replayRecord}: Props) {
  const location = useLocation();
  const eventView = EventView.fromLocation(location);
  const labelTitle = replayRecord?.user.display_name;

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
          label: labelTitle ? (
            <Fragment>
              {labelTitle} <ReplaysFeatureBadge />
            </Fragment>
          ) : (
            <HeaderPlaceholder width="500px" height="24px" />
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
