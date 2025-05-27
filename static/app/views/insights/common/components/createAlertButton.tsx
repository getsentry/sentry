import {LinkButton} from 'sentry/components/core/button/linkButton';
import {t} from 'sentry/locale';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

type Props = {
  search?: MutableSearch;
  yAxis?: string;
};

export function CreateAlertButton({yAxis, search}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const [interval] = useChartInterval();

  const project =
    projects.length === 1
      ? projects[0]
      : projects.find(p => p.id === `${selection.projects[0]}`);

  const url = yAxis
    ? getAlertsUrl({
        project,
        query: search?.formatString(),
        dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
        pageFilters: selection,
        aggregate: yAxis,
        organization,
        interval,
      })
    : '';

  return (
    <LinkButton size="xs" disabled={!yAxis} to={url}>
      {t('Create Alert')}
    </LinkButton>
  );
}
