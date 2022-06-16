import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization} from 'sentry/types';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  children: React.ReactChildren;
  organization: Organization;
};

function PerformanceContainer({organization, children}: Props) {

  function renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  return (
    <Feature
      hookName="feature-disabled:performance-page"
      features={['performance-view']}
      organization={organization}
      renderDisabled={renderNoAccess}
    >
      <MEPSettingProvider>{children}</MEPSettingProvider>
    </Feature>
  );
}

export default withOrganization(PerformanceContainer);
