import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getSpansQueryHref, type SpansQueryData} from './spansQueryUtils';

/**
 * The name the model gave the query, or a description of what it searches. The
 * block renders this as its heading, so both levels name the query the same way.
 */
export function getSpansQueryTitle(data: SpansQueryData): string {
  return (
    data.title ??
    (data.mode === 'aggregate' ? t('Aggregated span search') : t('Span search'))
  );
}

export function SpansQueryLink({data}: {data: SpansQueryData}) {
  const organization = useOrganization();
  const href = getSpansQueryHref(data, organization);

  return <ResourceLink icon={IconSpan} href={href} title={getSpansQueryTitle(data)} />;
}
