import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  buildErrorsEventView,
  getErrorsQueryHref,
  type ErrorsQueryData,
} from './errorsQueryUtils';

export function ErrorsQueryLink({data}: {data: ErrorsQueryData}) {
  const organization = useOrganization();
  const eventView = buildErrorsEventView(data);
  const href = getErrorsQueryHref(eventView, organization);

  return (
    <ResourceLink
      icon={IconSearch}
      href={href}
      title={
        data.title ??
        (data.mode === 'aggregate' ? t('Aggregated error search') : t('Error search'))
      }
    />
  );
}
