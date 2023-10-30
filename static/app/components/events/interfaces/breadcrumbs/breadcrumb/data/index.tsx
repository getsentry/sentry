import type {BreadcrumbTransactionEvent} from 'sentry/components/events/interfaces/breadcrumbs/types';
import {BreadcrumbMeta} from 'sentry/components/events/interfaces/breadcrumbs/types';
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
  meta?: BreadcrumbMeta;
  transactionEvents?: BreadcrumbTransactionEvent[];
};

export function Data({
  breadcrumb,
  event,
  organization,
  searchTerm,
  meta,
  transactionEvents,
}: Props) {
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
      transactionEvents={transactionEvents}
    />
  );
}
