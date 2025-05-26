import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';

type Props = {
  yAxes: string[];
  search?: MutableSearch;
  title?: string;
};

export function OpenInExploreButton({yAxes, title, search}: Props) {
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
        title: title ?? yAxes[0],
        query: search?.formatString(),
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
