import omit from 'lodash/omit';

import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import Highlight from 'sentry/components/highlight';
import ExternalLink from 'sentry/components/links/externalLink';
import {t} from 'sentry/locale';
import {BreadcrumbTypeHTTP, Crumb} from 'sentry/types/breadcrumbs';
import {defined} from 'sentry/utils';

import Summary from './summary';

type Props = {
  breadcrumb: BreadcrumbTypeHTTP;
  searchTerm: string;
  linkedEvent?: React.ReactElement;
  meta?: Record<keyof Crumb, any>;
};

export function Http({breadcrumb, searchTerm, meta, linkedEvent}: Props) {
  const {data} = breadcrumb;

  const renderUrl = (url: any) => {
    if (typeof url === 'string') {
      const content = <Highlight text={searchTerm}>{url}</Highlight>;
      return url.match(/^https?:\/\//) ? (
        <ExternalLink data-test-id="http-renderer-external-link" href={url}>
          {content}
        </ExternalLink>
      ) : (
        <span>{content}</span>
      );
    }

    try {
      return <Highlight text={searchTerm}>{JSON.stringify(url)}</Highlight>;
    } catch {
      return t('Invalid URL');
    }
  };

  if (defined(data) && meta?.data?.['']) {
    return <AnnotatedText value={data} meta={meta?.data?.['']} />;
  }

  return (
    <Summary kvData={omit(data, ['method', 'url', 'status_code'])}>
      {linkedEvent}
      {defined(data?.method) &&
        (meta?.data?.method?.[''] ? (
          <AnnotatedText value={data?.method} meta={meta?.data?.method?.['']} />
        ) : (
          <strong>
            <Highlight text={searchTerm}>{`${data?.method} `}</Highlight>
          </strong>
        ))}
      {defined(data?.url) &&
        (meta?.data?.url?.[''] ? (
          <AnnotatedText value={data?.url} meta={meta?.data?.url?.['']} />
        ) : (
          renderUrl(data?.url)
        ))}
      {defined(data?.status_code) &&
        (meta?.data?.status_code?.[''] ? (
          <AnnotatedText value={data?.status_code} meta={meta?.data?.status_code?.['']} />
        ) : (
          <Highlight
            data-test-id="http-renderer-status-code"
            text={searchTerm}
          >{` [${data?.status_code}]`}</Highlight>
        ))}
    </Summary>
  );
}
