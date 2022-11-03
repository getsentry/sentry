import {Fragment, useCallback, useEffect} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Button from 'sentry/components/button';
import FeatureBadge from 'sentry/components/featureBadge';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import {Panel, PanelBody, PanelFooter, PanelHeader} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {DynamicSamplingBias, DynamicSamplingBiasType} from 'sentry/types/sampling';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';
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

const knowBiases = {
  [DynamicSamplingBiasType.BOOST_LATEST_RELEASES]: {
    label: t('Prioritize new releases'),
    help: t('Captures more transactions for your new releases as they are being adopted'),
  },
  [DynamicSamplingBiasType.BOOST_ENVIRONMENTS]: {
    label: t('Prioritize dev environments'),
    help: t('Captures more traces from environments that contain “dev” and “test”'),
  },
  [DynamicSamplingBiasType.IGNORE_HEALTH_CHECKS]: {
    label: t('Ignore health checks'),
    help: t('Discards your health checks transactions'),
  },
};

export function DynamicSampling({project}: Props) {
  const organization = useOrganization();
  const api = useApi();

  const hasAccess = organization.access.includes('project:write');
  const biases = project.dynamicSamplingBiases ?? [];

  useEffect(() => {
    trackAdvancedAnalyticsEvent('dynamic_sampling_settings.viewed', {
      organization,
      project_id: project.id,
    });
  }, [project.id, organization]);

  async function handleToggle(bias: DynamicSamplingBias) {
    addLoadingMessage();

    const newDynamicSamplingBiases = biases.map(b => {
      if (b.id === bias.id) {
        return {...b, active: !b.active};
      }
      return b;
    });

    try {
      const result = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {
          method: 'PUT',
          data: {
            dynamicSamplingBiases: newDynamicSamplingBiases,
          },
        }
      );

      trackAdvancedAnalyticsEvent(
        bias.active
          ? 'dynamic_sampling_settings.priority_disabled'
          : 'dynamic_sampling_settings.priority_enabled',
        {
          organization,
          project_id: project.id,
          id: bias.id,
        }
      );

      ProjectsStore.onUpdateSuccess(result);
      addSuccessMessage(t('Successfully updated dynamic sampling configuration'));
    } catch (error) {
      const message = t('Unable to update dynamic sampling configuration');
      handleXhrErrorResponse(message)(error);
      addErrorMessage(message);
    }
  }

  const handleReadDocs = useCallback(() => {
    trackAdvancedAnalyticsEvent('dynamic_sampling_settings.read_docs_clicked', {
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
            'Sentry aims to capture the most valuable transactions in full detail, so you have the necessary data to resolve any performance issues.'
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
          <PanelHeader>{t('Sampling Priorities')}</PanelHeader>
          <PanelBody>
            {Object.entries(knowBiases).map(([key, value]) => {
              const bias = biases.find(b => b.id === key);

              if (!bias) {
                return null;
              }

              return (
                <BooleanField
                  {...value}
                  key={key}
                  name={key}
                  value={bias.active}
                  onChange={() => handleToggle(bias)}
                  disabled={!hasAccess}
                  disabledReason={
                    !hasAccess
                      ? t('You do not have permission to edit this setting')
                      : undefined
                  }
                />
              );
            })}
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
