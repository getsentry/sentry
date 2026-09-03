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
import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getExploreUrl} from 'sentry/views/explore/utils';

function SpansQueryLink(props: EmbedOutput<'spansQuery'>) {
  const organization = useOrganization();
  const {query, mode, sort, fields, groupBy, yAxes, title} = props;

  const href = getExploreUrl({
    organization,
    selection: toPageFilters(props),
    query,
    mode: toMode(mode),
    field: fields,
    sort,
    aggregateField: toAggregateFields({groupBy, yAxes}),
  });

  return <ResourceLink icon={IconSpan} href={href} title={title ?? t('Span search')} />;
}

export const SpansQuery = defineSeerEmbed({
  name: 'spansQuery',
  render(props) {
    return <SpansQueryLink {...props} />;
  },
});
