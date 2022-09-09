import {ComponentProps, Fragment} from 'react';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import Placeholder from 'sentry/components/placeholder';
import ReplaysFeatureBadge from 'sentry/components/replays/replaysFeatureBadge';
import {t} from 'sentry/locale';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  orgSlug: string;
  replayRecord: ReplayRecord | undefined;
};

function DetailsPageBreadcrumbs({orgSlug, replayRecord}: Props) {
  const labelTitle = replayRecord?.user.displayName;

  return (
    <Breadcrumbs
      crumbs={[
        {
          to: `/organizations/${orgSlug}/replays/`,
          label: t('Replays'),
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
