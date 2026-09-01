import {
  toAggregateFields,
  toMode,
  toPageFilters,
} from 'sentry/components/seer/markdown/embeds/components/queryEmbedParams';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconList} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getLogsUrl} from 'sentry/views/explore/logs/utils';

function LogsQueryLink(props: EmbedOutput<'logsQuery'>) {
  const organization = useOrganization();
  const {query, mode, sort, fields, groupBy, yAxes, title} = props;

  const href = getLogsUrl({
    organization,
    selection: toPageFilters(props),
    query,
    mode: toMode(mode),
    field: fields,
    sortBy: sort,
    aggregateFields: toAggregateFields({groupBy, yAxes}),
  });

  return <ResourceLink icon={IconList} href={href} title={title ?? t('Log search')} />;
}

export const LogsQuery = defineSeerEmbed({
  name: 'logsQuery',
  render(props) {
    return <LogsQueryLink {...props} />;
  },
});
