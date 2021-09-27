import {Organization} from 'app/types';
import {BreadcrumbType, RawCrumb} from 'app/types/breadcrumbs';
import {Event} from 'app/types/event';

import Default from './default';
import Exception from './exception';
import Http from './http';

type Props = {
  searchTerm: string;
  breadcrumb: RawCrumb;
  event: Event;
  orgSlug: Organization['slug'];
};

const Data = ({breadcrumb, event, orgSlug, searchTerm}: Props) => {
  if (breadcrumb.type === BreadcrumbType.HTTP) {
    return <Http breadcrumb={breadcrumb} searchTerm={searchTerm} />;
  }

  if (
    breadcrumb.type === BreadcrumbType.WARNING ||
    breadcrumb.type === BreadcrumbType.ERROR
  ) {
    return <Exception breadcrumb={breadcrumb} searchTerm={searchTerm} />;
  }

  return (
    <Default
      event={event}
      orgSlug={orgSlug}
      breadcrumb={breadcrumb}
      searchTerm={searchTerm}
    />
  );
};

export default Data;
