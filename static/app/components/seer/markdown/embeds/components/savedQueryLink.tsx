import queryString from 'query-string';

import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {EXPLORE_AGENTS_SUB_PATH} from 'sentry/views/explore/conversations/settings';
import {makeLogsPathname} from 'sentry/views/explore/logs/utils';
import {makeMetricsPathname} from 'sentry/views/explore/metrics/utils';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

export type SavedQueryData = EmbedOutput<'savedQuery'>;

type Dataset = SavedQueryData['dataset'];

/**
 * Explore has no saved-query detail route. Opening one means loading the
 * dataset's own explore surface with the saved query's `id`.
 */
function datasetPathname(dataset: Dataset, organization: Organization): string {
  switch (dataset) {
    case 'logs':
      return makeLogsPathname({organizationSlug: organization.slug, path: '/'});
    case 'metrics':
      return makeMetricsPathname({organizationSlug: organization.slug, path: '/'});
    case 'replays':
      return makeReplaysPathname({organization, path: '/'});
    case 'ai_conversations':
      return normalizeUrl(
        `/organizations/${organization.slug}/explore/${EXPLORE_AGENTS_SUB_PATH}/`
      );
    // `segment_spans` is a saved-query-only distinction; both open Traces.
    case 'spans':
    case 'segment_spans':
      return makeTracesPathname({organization, path: '/'});
    default:
      dataset satisfies never;
      return makeTracesPathname({organization, path: '/'});
  }
}

/**
 * The inline link, which knows only what the tag carried. Restoring the saved
 * query's own filters would mean fetching it, and an inline mention shouldn't
 * cost a request — the block level does that and links precisely.
 */
export function SavedQueryLink({data}: {data: SavedQueryData}) {
  const organization = useOrganization();
  const href = queryString.stringifyUrl({
    url: datasetPathname(data.dataset, organization),
    query: {id: data.id},
  });

  return (
    <ResourceLink
      icon={IconStar}
      href={href}
      title={data.name ?? t('Saved query %s', data.id)}
    />
  );
}
