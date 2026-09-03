import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getSpansQueryHref, type SpansQueryData} from './spansQueryUtils';

export function SpansQueryLink({data}: {data: SpansQueryData}) {
  const organization = useOrganization();
  const href = getSpansQueryHref(data, organization);

  return (
    <ResourceLink
      icon={IconSpan}
      href={href}
      title={
        data.title ??
        (data.mode === 'aggregate' ? t('Aggregated span search') : t('Span search'))
      }
    />
  );
}
