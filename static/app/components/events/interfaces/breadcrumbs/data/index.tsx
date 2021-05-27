import {Breadcrumb, BreadcrumbType} from 'app/types/breadcrumbs';
import {Event} from 'app/types/event';

import Default from './default';
import Exception from './exception';
import Http from './http';

type Props = {
  searchTerm: string;
  breadcrumb: Breadcrumb;
  event: Event;
  orgId: string | null;
  onToggle: () => void;
};

const Data = ({breadcrumb, event, orgId, searchTerm, onToggle}: Props) => {
  if (breadcrumb.type === BreadcrumbType.HTTP) {
    return <Http breadcrumb={breadcrumb} searchTerm={searchTerm} onToggle={onToggle} />;
  }

  if (
    breadcrumb.type === BreadcrumbType.WARNING ||
    breadcrumb.type === BreadcrumbType.ERROR
  ) {
    return (
      <Exception breadcrumb={breadcrumb} searchTerm={searchTerm} onToggle={onToggle} />
    );
  }

  return (
    <Default
      event={event}
      orgId={orgId}
      breadcrumb={breadcrumb}
      searchTerm={searchTerm}
      onToggle={onToggle}
    />
  );
};

export default Data;
