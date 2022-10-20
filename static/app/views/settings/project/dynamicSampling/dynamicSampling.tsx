import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import FeatureBadge from 'sentry/components/featureBadge';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import {Panel, PanelBody, PanelFooter, PanelHeader} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/organization/permissionAlert';

import {SamplingFeedback} from './samplingFeedback';

const SERVER_SIDE_SAMPLING_DOC_LINK =
  'https://docs.sentry.io/product/data-management-settings/dynamic-sampling/';

type Props = {
  project: Project;
};

export function DynamicSampling({project}: Props) {
  const organization = useOrganization();

  const [boostEnvironments, setBoostEnvironments] = useState(true);
  const [boostLatestRelease, setBoostLatestRelease] = useState(true);
  const [ignoreHealthChecks, setIgnoreHealthChecks] = useState(true);

  const hasAccess = organization.access.includes('project:write');

  useEffect(() => {
    trackAdvancedAnalyticsEvent('sampling.settings.view', {
      organization,
      project_id: project.id,
    });
  }, [project.id, organization]);

  // async function handleToggleOption() {
  //   addLoadingMessage();
  //   try {
  //     const result = await api.requestPromise(
  //       `/projects/${organization.slug}/${project.slug}/`,
  //       {
  //         method: 'PUT',
  //         data: {
  //           dynamicSampling: [
  //             {
  //               id: 'boostEnvironments',
  //               active: true,
  //             },
  //             {
  //               id: 'boostLatestRelease',
  //               active: true,
  //             },
  //             {
  //               id: 'ignoreHealthChecks',
  //               active: true,
  //             },
  //           ],
  //         },
  //       }
  //     );
  //     ProjectsStore.onUpdateSuccess(result);
  //     addSuccessMessage(t('Successfully dynamic sampling configuration'));
  //   } catch (error) {
  //     const message = t('Unable to update dynamic sampling configuration');
  //     handleXhrErrorResponse(message)(error);
  //     addErrorMessage(message);
  //   }
  // }

  const handleReadDocs = useCallback(() => {
    trackAdvancedAnalyticsEvent('sampling.settings.view_read_docs', {
      organization,
      project_id: project.id,
    });
  }, [organization, project.id]);

  return (
    <SentryDocumentTitle title={t('Dynamic Sampling')}>
      <Fragment>
        <SettingsPageHeader
          title={
            <Fragment>
              {t('Dynamic Sampling')} <FeatureBadge type="beta" />
            </Fragment>
          }
          action={<SamplingFeedback />}
        />
        <TextBlock>
          {t(
            'Sentry aims to capture the most valuable traces in full detail, so you have all the necessary data to resolve any performance issues.'
          )}
        </TextBlock>
        <PermissionAlert
          organization={organization}
          access={['project:write']}
          message={t(
            'These settings can only be edited by users with the organization owner, manager, or admin role.'
          )}
        />
        <Panel>
          <PanelHeader>{t('Dynamic Sampling')}</PanelHeader>
          <PanelBody>
            <BooleanField
              name="boostLatestRelease"
              label={t('Prioritize new releases')}
              value={boostLatestRelease}
              onChange={() => setBoostLatestRelease(!boostLatestRelease)}
              disabled={!hasAccess}
              disabledReason={
                !hasAccess
                  ? t('You do not have permission to edit this setting')
                  : undefined
              }
              help={t('Captures more traces for a new release roll-out')}
            />
            <BooleanField
              name="boostEnvironments"
              label={t('Prioritize dev environments')}
              value={boostEnvironments}
              onChange={() => setBoostEnvironments(!boostEnvironments)}
              disabled={!hasAccess}
              disabledReason={
                !hasAccess
                  ? t('You do not have permission to edit this setting')
                  : undefined
              }
              help={t(
                'Captures more traces from environments that contain “dev” and “test”'
              )}
            />
            <BooleanField
              name="ignoreHealthChecks"
              label={t('Ignore health checks')}
              value={ignoreHealthChecks}
              onChange={() => setIgnoreHealthChecks(!ignoreHealthChecks)}
              disabled={!hasAccess}
              disabledReason={
                !hasAccess
                  ? t('You do not have permission to edit this setting')
                  : undefined
              }
              help={t('Discards transactions that contain “health” in the name')}
            />
          </PanelBody>
          <StyledPanelFooter>
            <Button
              href={SERVER_SIDE_SAMPLING_DOC_LINK}
              onClick={handleReadDocs}
              external
            >
              {t('Read Docs')}
            </Button>
          </StyledPanelFooter>
        </Panel>
      </Fragment>
    </SentryDocumentTitle>
  );
}

const StyledPanelFooter = styled(PanelFooter)`
  padding: ${space(1.5)} ${space(2)};
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;
