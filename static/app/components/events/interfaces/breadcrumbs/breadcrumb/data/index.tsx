import {Organization} from 'sentry/types';
import {BreadcrumbType, RawCrumb} from 'sentry/types/breadcrumbs';
import {Event} from 'sentry/types/event';

import {Default} from './default';
import {Exception} from './exception';
import {Http} from './http';

type Props = {
  breadcrumb: RawCrumb;
  event: Event;
  organization: Organization;
  searchTerm: string;
  meta?: Record<any, any>;
};

export function Data({breadcrumb, event, organization, searchTerm, meta}: Props) {
  const orgSlug = organization.slug;

  if (breadcrumb.type === BreadcrumbType.HTTP) {
    return <Http breadcrumb={breadcrumb} searchTerm={searchTerm} meta={meta} />;
  }

  if (
    breadcrumb.type === BreadcrumbType.WARNING ||
    breadcrumb.type === BreadcrumbType.ERROR
  ) {
    return <Exception breadcrumb={breadcrumb} searchTerm={searchTerm} meta={meta} />;
  }

  return (
    <Default
      event={event}
      orgSlug={orgSlug}
      breadcrumb={breadcrumb}
      searchTerm={searchTerm}
      meta={meta}
    />
  );
}
