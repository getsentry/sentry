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
      addLoadingMessage(t('Toggling sampled mode'));
    },
    onSuccess: updatedProject => {
      addSuccessMessage(t('Successfully toggled sampled mode'));
      ProjectsStore.onUpdateSuccess(updatedProject);
    },
    onError: () => {
      addErrorMessage(t('Failed to toggle sampled mode'));
    },
  });

  return (
    <Panel>
      <PanelBody>
        <BooleanField
          onChange={handleToggleChange}
          value={isToggleEnabled}
          name="metrics-extrapolation-toggle"
          disabled={!project.access.includes('project:write')} // admin, manager and owner of an organization will be able to edit this field
          label={t('Sampled Mode')}
          help={tct(
            'Typically, Sentry uses weights to approximate original volume and correct sampling skew. Enable sampled mode to view raw event data, where sample rates are ignored in calculations. [link:Read the docs] to learn more.',
            {
              // TODO(telemetry-experience): Add link to metrics extrapolation docs when available
              link: <ExternalLink href="https://docs.sentry.io/product/metrics/" />,
            }
          )}
        />
      </PanelBody>
    </Panel>
  );
}
