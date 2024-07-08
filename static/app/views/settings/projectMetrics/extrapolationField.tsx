import {useEffect, useState} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface ExtrapolationFieldProps {
  project: Project;
}

export function ExtrapolationField({project}: ExtrapolationFieldProps) {
  const organization = useOrganization();
  const api = useApi();

  const [isToggleEnabled, setIsToggleEnabled] = useState(!!project.extrapolateMetrics);

  // Reload from props if new project state is received
  useEffect(() => {
    setIsToggleEnabled(!!project.extrapolateMetrics);
  }, [project.extrapolateMetrics]);

  const {mutate: handleToggleChange} = useMutation<Project, RequestError, boolean>({
    mutationFn: value => {
      return api.requestPromise(`/projects/${organization.slug}/${project.slug}/`, {
        method: 'PUT',
        data: {
          extrapolateMetrics: value,
        },
      });
    },
    onMutate: () => {
      addLoadingMessage(t('Toggling metrics extrapolation'));
    },
    onSuccess: updatedProject => {
      addSuccessMessage(t('Successfully toggled metrics extrapolation'));
      ProjectsStore.onUpdateSuccess(updatedProject);
    },
    onError: () => {
      addErrorMessage(t('Failed to toggle metrics extrapolation'));
    },
  });

  // admin, manager and owner of an organization will be able to edit this field
  const hasProjectWrite = project.access.includes('project:write');

  return (
    <Panel>
      <PanelBody>
        <Tooltip
          title={t('You do not have permissions to edit this field.')}
          disabled={hasProjectWrite}
        >
          <BooleanField
            onChange={handleToggleChange}
            value={isToggleEnabled}
            name="metrics-extrapolation-toggle"
            disabled={!hasProjectWrite}
            label={t('Metrics Extrapolation')}
            help={tct(
              'Enables metrics extrapolation from sampled data, providing more reliable and comprehensive metrics for your project. To learn more about metrics extrapolation, [link:read the docs]',
              {
                // TODO(telemetry-experience): Add link to metrics extrapolation docs when available
                link: <ExternalLink href="https://docs.sentry.io/product/metrics/" />,
              }
            )}
          />
        </Tooltip>
      </PanelBody>
    </Panel>
  );
}
