import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {trendsTargetRoute} from 'sentry/views/performance/utils';

export function ViewTrendsButton() {
  const location = useLocation();
  const organization = useOrganization();
  const navigate = useNavigate();

  const handleTrendsClick = () => {
    const target = trendsTargetRoute({organization, location});
    navigate(target);
  };
  return (
    <Button
      size="sm"
      priority="primary"
      data-test-id="landing-header-trends"
      onClick={() => handleTrendsClick()}
    >
      {t('View Trends')}
    </Button>
  );
}
