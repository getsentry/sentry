import omit from 'lodash/omit';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import Highlight from 'sentry/components/highlight';
import {BreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';
import {defined} from 'sentry/utils';

import Summary from './summary';

type Props = {
  breadcrumb: BreadcrumbTypeDefault;
  searchTerm: string;
  meta?: Record<any, any>;
};

export function Exception({breadcrumb, searchTerm, meta}: Props) {
  const {data, message} = breadcrumb;

  return (
    <Summary kvData={!data ? data : omit(data, ['type', 'value'])} meta={meta}>
      {meta?.type?.[''] ? (
        <AnnotatedText value={data?.type} meta={meta?.type?.['']} />
      ) : (
        defined(data?.type) && (
          <strong>
            <Highlight text={searchTerm}>{`${data?.type}: `}</Highlight>
          </strong>
        )
      )}
      {meta?.data?.value?.[''] ? (
        <AnnotatedText value={data?.value} meta={meta?.data?.value?.['']} />
      ) : (
        defined(data?.value) && (
          <Highlight text={searchTerm}>
            {breadcrumb?.message ? `${data?.value}. ` : data?.value}
          </Highlight>
        )
      )}
      {meta?.message?.[''] ? (
        <AnnotatedText value={message} meta={meta?.message?.['']} />
      ) : (
        defined(message) && <Highlight text={searchTerm}>{message}</Highlight>
      )}
    </Summary>
  );
}
