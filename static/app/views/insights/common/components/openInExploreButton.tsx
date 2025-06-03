import {LinkButton} from 'sentry/components/core/button/linkButton';
import {t} from 'sentry/locale';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import type {ChartType} from 'sentry/views/insights/common/components/chart';
import {type SpanFields} from 'sentry/views/insights/types';

type Props = {
  chartType: ChartType;
  yAxes: string[];
  groupBy?: SpanFields[];
  search?: MutableSearch;
  title?: string;
};

export function OpenInExploreButton({yAxes, title, search, chartType, groupBy}: Props) {
  const organization = useOrganization();

  const url = getExploreUrl({
    organization,
    visualize: [
      {
        chartType,
        yAxes,
      },
    ],
    mode: Mode.AGGREGATE,
    title: title ?? yAxes[0],
    query: search?.formatString(),
    sort: undefined,
    groupBy,
  });

  return (
    <LinkButton size="xs" to={url}>
      {t('Open in Explore')}
    </LinkButton>
  );
}
