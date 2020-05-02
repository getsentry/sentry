import React from 'react';

import Feature from 'app/components/acl/feature';
import BreadcrumbsInterface from 'app/components/events/interfaces/breadcrumbs/breadcrumbs';
import BreadcrumbsInterfaceV2 from 'app/components/events/interfaces/breadcrumbsV2/breadcrumbs';

type Props = React.ComponentProps<typeof BreadcrumbsInterfaceV2>;

const EventEntriesBreadcrumbs = (props: Props) => (
  <Feature features={['breadcrumbs-v2']}>
    {({hasFeature}) =>
      hasFeature ? (
        <BreadcrumbsInterfaceV2 {...props} />
      ) : (
        <BreadcrumbsInterface {...props} />
      )
    }
  </Feature>
);

export default EventEntriesBreadcrumbs;
