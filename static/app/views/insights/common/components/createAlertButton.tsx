import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
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
  const navigate = useNavigate();
  const organization = useOrganization();
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const [interval] = useChartInterval();

  const project =
    projects.length === 1
      ? projects[0]
      : projects.find(p => p.id === `${selection.projects[0]}`);

  const handleButtonClick = () => {
    if (yAxis) {
      navigate(
        getAlertsUrl({
          project,
          query: search?.formatString(),
          pageFilters: selection,
          aggregate: yAxis,
          organization,
          dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
          interval,
        })
      );
    }
  };

  return (
    <Button size="xs" disabled={!yAxis} onClick={handleButtonClick}>
      {t('Create Alert')}
    </Button>
  );
}
