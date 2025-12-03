import {Stack} from '@sentry/scraps/layout/stack';

import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import SeerProjectTable from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTable';
import {SeerAutomationProjectList} from 'getsentry/views/seerAutomation/components/seerAutomationProjectList';

export default function SeerAutomationProjects() {
  const organization = useOrganization();

  return (
    <Feature
      features={['seer-settings-gtm']}
      organization={organization}
      renderDisabled={NoAccess}
    >
      <SentryDocumentTitle title={t('Seer')} orgSlug={organization.slug} />
      <Stack gap="lg">
        <SeerProjectTable />
        <SeerAutomationProjectList />
      </Stack>
    </Feature>
  );
}
