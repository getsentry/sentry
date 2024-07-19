import {Sql} from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/data/sql';
import type {
  BreadcrumbMeta,
  BreadcrumbTransactionEvent,
} from 'sentry/components/events/interfaces/breadcrumbs/types';
import type {RawCrumb} from 'sentry/types/breadcrumbs';
import {BreadcrumbMessageFormat, BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';

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
  if (breadcrumb.type === BreadcrumbType.HTTP) {
    return <Http breadcrumb={breadcrumb} searchTerm={searchTerm} meta={meta} />;
  }

  if (
    !meta &&
    breadcrumb.message &&
    breadcrumb.messageFormat === BreadcrumbMessageFormat.SQL
  ) {
    return <Sql breadcrumb={breadcrumb} searchTerm={searchTerm} />;
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
      organization={organization}
      breadcrumb={breadcrumb}
      searchTerm={searchTerm}
      meta={meta}
      transactionEvents={transactionEvents}
    />
  );
}
