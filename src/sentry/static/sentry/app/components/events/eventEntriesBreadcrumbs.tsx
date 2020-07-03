import React from 'react';

import Feature from 'app/components/acl/feature';
import BreadcrumbsInterface from 'app/components/events/interfaces/breadcrumbs/breadcrumbs';
import Breadcrumbs from 'app/components/events/interfaces/breadcrumbsV2/breadcrumbs';

type Props = React.ComponentProps<typeof Breadcrumbs>;
type BreadcrumbsInterfaceProps = React.ComponentProps<typeof BreadcrumbsInterface>;

const EventEntriesBreadcrumbs = (props: Props) => (
  <Feature features={['breadcrumbs-v2']}>
    {({hasFeature}) =>
      hasFeature ? (
        <Breadcrumbs {...props} />
      ) : (
        <BreadcrumbsInterface {...(props as BreadcrumbsInterfaceProps)} />
      )
    }
  </Feature>
);

export default EventEntriesBreadcrumbs;
