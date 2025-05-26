import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';

type Props = {
  yAxes: string[];
};

export function OpenInExploreButton({yAxes}: Props) {
  const navigate = useNavigate();
  const organization = useOrganization();

  const handleButtonClick = () => {
    navigate(
      getExploreUrl({
        organization,
        visualize: [
          {
            chartType: ChartType.LINE,
            yAxes,
          },
        ],
        mode: Mode.AGGREGATE,
        title: 'chart title',
        query: '',
        sort: undefined,
        groupBy: undefined,
      })
    );
  };

  return (
    <Button size="xs" onClick={handleButtonClick}>
      {t('Open in Explore')}
    </Button>
  );
}
