import {ComponentProps, Fragment} from 'react';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import FeatureBadge from 'sentry/components/featureBadge';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types/event';

type Props = {
  orgId: string;
  event?: Event;
};

function DetailsPageBreadcrumbs({orgId, event}: Props) {
  const labelTitle =
    event?.user?.name ||
    event?.user?.email ||
    event?.user?.username ||
    event?.user?.ip_address ||
    event?.user?.id;

  return (
    <Breadcrumbs
      crumbs={[
        {
          to: `/organizations/${orgId}/replays/`,
          label: t('Replays'),
        },
        {
          label: labelTitle ? (
            <Fragment>
              {labelTitle} <FeatureBadge type="alpha" />
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
