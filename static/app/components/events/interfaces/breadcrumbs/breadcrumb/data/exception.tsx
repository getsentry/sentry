import omit from 'lodash/omit';

import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import Highlight from 'sentry/components/highlight';
import {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import {defined} from 'sentry/utils';

import Summary from './summary';

type Props = {
  breadcrumb: BreadcrumbTypeDefault;
  searchTerm: string;
  linkedEvent?: React.ReactElement;
  meta?: Record<keyof Crumb, any>;
};

export function Exception({breadcrumb, searchTerm, meta, linkedEvent}: Props) {
  const {data, message} = breadcrumb;

  if (defined(data) && meta?.data?.['']) {
    return <AnnotatedText value={data} meta={meta?.data?.['']} />;
  }

  return (
    <Summary kvData={omit(data, ['type', 'value'])}>
      {linkedEvent}
      {defined(data?.type) &&
        (meta?.type?.[''] ? (
          <AnnotatedText value={data?.type} meta={meta?.type?.['']} />
        ) : (
          <strong>
            <Highlight text={searchTerm}>{`${data?.type}: `}</Highlight>
          </strong>
        ))}
      {defined(data?.value) &&
        (meta?.data?.value?.[''] ? (
          <AnnotatedText value={data?.value} meta={meta?.data?.value?.['']} />
        ) : (
          <Highlight text={searchTerm}>
            {breadcrumb?.message ? `${data?.value}. ` : data?.value}
          </Highlight>
        ))}
      {defined(message) &&
        (meta?.message?.[''] ? (
          <AnnotatedText value={message} meta={meta?.message?.['']} />
        ) : (
          <Highlight text={searchTerm}>{message}</Highlight>
        ))}
    </Summary>
  );
}
