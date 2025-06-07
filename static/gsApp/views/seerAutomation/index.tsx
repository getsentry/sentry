import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import Link from 'sentry/components/links/link';
import {NoAccess} from 'sentry/components/noAccess';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategoryExact} from 'sentry/types/core';
import useOrganization from 'sentry/utils/useOrganization';
import {getPricingDocsLinkForEventType} from 'sentry/views/settings/account/notifications/utils';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

import {SeerAutomationDefault} from './seerAutomationDefault';
import {SeerAutomationProjectList} from './seerAutomationProjectList';

function SeerAutomationRoot() {
  const organization = useOrganization();
  if (!organization.features.includes('trigger-autofix-on-issue-summary')) {
    return <NoAccess />;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Seer Automation')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Seer Automation')}
        subtitle={t(
          'Seer can automatically find a root cause and solution for incoming issues.'
        )}
      />
      <StyledAlert type="info">
        {tct(
          "Choose how Seer automates analysis of incoming issues across your projects. Automated scans and fixes are charged at the [link:standard billing rates] for Seer's Issue Scan and Issue Fix. See [spendlink:docs] on how to manage your Seer spend.",
          {
            link: <Link to={'https://docs.sentry.io/pricing/#seer-pricing'} />,
            spendlink: (
              <Link to={getPricingDocsLinkForEventType(DataCategoryExact.SEER_AUTOFIX)} />
            ),
          }
        )}
      </StyledAlert>
      <ProjectPermissionAlert />

      <NoProjectMessage organization={organization}>
        <SeerAutomationDefault />
        <SeerAutomationProjectList />
      </NoProjectMessage>
    </Fragment>
  );
}

const StyledAlert = styled(Alert)`
  margin-bottom: ${space(1)};
`;

export default SeerAutomationRoot;
