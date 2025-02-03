import {navigateTo} from 'sentry/actionCreators/navigation';
import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import useRouter from 'sentry/utils/useRouter';
import {getPerformanceBaseUrl} from 'sentry/views/performance/utils';

type Props = {
  organization: Organization;
};

function MissingPerformanceButtons({organization}: Props) {
  const router = useRouter();

  return (
    <Feature
      hookName="feature-disabled:project-performance-score-card"
      features="performance-view"
      organization={organization}
    >
      <ButtonBar gap={1}>
        <Button
          size="sm"
          priority="primary"
          onClick={event => {
            event.preventDefault();
            // TODO: add analytics here for this specific action.
            navigateTo(
              `${getPerformanceBaseUrl(organization.slug)}/?project=:project#performance-sidequest`,
              router
            );
          }}
        >
          {t('Start Setup')}
        </Button>
      </ButtonBar>
    </Feature>
  );
}

export default MissingPerformanceButtons;
