import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  buildErrorsEventView,
  getErrorsQueryHref,
  type ErrorsQueryData,
  type ErrorsQueryKind,
} from './errorsQueryUtils';

export function ErrorsQueryLink({
  data,
  kind,
}: {
  data: ErrorsQueryData;
  kind: ErrorsQueryKind;
}) {
  const organization = useOrganization();
  const eventView = buildErrorsEventView(data, kind);
  const href = getErrorsQueryHref(eventView, organization);

  return (
    <ResourceLink
      icon={IconSearch}
      href={href}
      title={
        data.title ??
        (kind === 'aggregate' ? t('Aggregated error search') : t('Error search'))
      }
    />
  );
}
