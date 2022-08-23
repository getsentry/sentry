import {Fragment, useEffect, useState} from 'react';
import isEqual from 'lodash/isEqual';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import FeatureBadge from 'sentry/components/featureBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t, tct} from 'sentry/locale';
import ProjectStore from 'sentry/stores/projectsStore';
import {Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/organization/permissionAlert';

import {FlagModal} from './modals/flagModal';
import {SegmentModal} from './modals/segmentModal';
import {Card} from './card';
import {FeatureFlagsPromo} from './featureFlagsPromo';

type Props = ModalRenderProps & {
  project: Project;
};

export default function ProjectFeatureFlags({project}: Props) {
  const api = useApi();
  const organization = useOrganization();

  const currentFlags = project.featureFlags;
  const hasAccess = organization.access.includes('project:write');
  const disabled = !hasAccess;
  const previousFlags = usePrevious(currentFlags);

  const [flags, setFlags] = useState(currentFlags ?? {});
  const showPromo = Object.keys(flags).length === 0;

  useEffect(() => {
    if (!isEqual(currentFlags, previousFlags)) {
      setFlags(currentFlags ?? {});
    }
  }, [currentFlags, previousFlags]);

  function handleAddFlag() {
    openModal(modalProps => (
      <FlagModal
        {...modalProps}
        organization={organization}
        project={project}
        flags={flags}
      />
    ));
  }

  function handleEditFlag(flagKey: string) {
    openModal(modalProps => (
      <FlagModal
        {...modalProps}
        organization={organization}
        project={project}
        flags={flags}
        flagKey={flagKey}
      />
    ));
  }

  async function handleDeleteFlag(flagKey: string) {
    const newFeatureFlags = {...flags};
    delete newFeatureFlags[flagKey];

    try {
      const result = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {
          method: 'PUT',
          data: {featureFlags: newFeatureFlags},
        }
      );
      ProjectStore.onUpdateSuccess(result);
      addSuccessMessage(t('Successfully deleted feature flag'));
    } catch (error) {
      const message = t('Unable to delete feature flag');
      handleXhrErrorResponse(message)(error);
      addErrorMessage(message);
    }
  }

  async function handleActivateToggle(flagKey: string) {
    const newFeatureFlags = {...flags};
    newFeatureFlags[flagKey].enabled = !newFeatureFlags[flagKey].enabled;

    addLoadingMessage();

    try {
      const result = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {
          method: 'PUT',
          data: {featureFlags: newFeatureFlags},
        }
      );

      ProjectStore.onUpdateSuccess(result);
      addSuccessMessage(t('Successfully updated the feature flag'));
    } catch (error) {
      const message = t('Unable to update the feature flag');
      handleXhrErrorResponse(message)(error);
      addErrorMessage(message);
    }
  }

  function handleAddSegment(flagKey: string) {
    openModal(modalProps => (
      <SegmentModal
        {...modalProps}
        organization={organization}
        project={project}
        flags={flags}
        flagKey={flagKey}
      />
    ));
  }

  function handleEditSegment(flagKey: string, index: number) {
    openModal(modalProps => (
      <SegmentModal
        {...modalProps}
        organization={organization}
        project={project}
        flags={flags}
        flagKey={flagKey}
        segmentIndex={index}
      />
    ));
  }

  async function handleDeleteSegment(flagKey: string, index: number) {
    const newEvaluations = [...flags[flagKey].evaluations];
    newEvaluations.splice(index, 1);

    const newFeatureFlags = {...flags};
    newFeatureFlags[flagKey].evaluations = newEvaluations;

    try {
      const result = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {
          method: 'PUT',
          data: {featureFlags: newFeatureFlags},
        }
      );

      ProjectStore.onUpdateSuccess(result);
      addSuccessMessage(t('Successfully deleted segment'));
    } catch (error) {
      const message = t('Unable to delete segment');
      handleXhrErrorResponse(message)(error);
      addErrorMessage(message);
    }
  }

  async function handleSortEvaluations(flagKey: string, evaluationIds: string[]) {
    const sortedEvaluations = evaluationIds
      .map(evaluationId =>
        flags[flagKey].evaluations.find(
          evaluation => String(evaluation.id) === evaluationId
        )
      )
      .filter(defined);

    const newFeatureFlags = {...flags};
    newFeatureFlags[flagKey].evaluations = sortedEvaluations;

    setFlags(newFeatureFlags);

    try {
      const result = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {
          method: 'PUT',
          data: {featureFlags: newFeatureFlags},
        }
      );
      ProjectStore.onUpdateSuccess(result);
      addSuccessMessage(t('Successfully sorted segments'));
    } catch (error) {
      setFlags(previousFlags ?? []);
      const message = t('Unable to sort segments');
      handleXhrErrorResponse(message)(error);
      addErrorMessage(message);
    }
  }

  return (
    <SentryDocumentTitle title={t('Feature Flags')}>
      <Fragment>
        <SettingsPageHeader
          title={
            <Fragment>
              {t('Feature Flags')} <FeatureBadge type="beta" />
            </Fragment>
          }
          action={
            !showPromo && (
              <Button
                title={
                  disabled ? t('You do not have permission to add flags') : undefined
                }
                priority="primary"
                size="sm"
                icon={<IconAdd size="xs" isCircled />}
                onClick={handleAddFlag}
                disabled={disabled}
              >
                {t('Add Flag')}
              </Button>
            )
          }
        />
        <TextBlock>
          {tct(
            'Feature flags allow you to configure your code into different flavors by dynamically toggling certain functionality on and off. Learn more about feature flags in our [link:documentation].',
            {
              link: <ExternalLink href="" />,
            }
          )}
        </TextBlock>

        <PermissionAlert access={['project:write']} />

        {showPromo ? (
          <FeatureFlagsPromo hasAccess={hasAccess} onGetStarted={handleAddFlag} />
        ) : (
          Object.keys(flags).map(flagKey => (
            <Card
              key={flagKey}
              flagKey={flagKey}
              {...flags[flagKey]}
              onDelete={() => handleDeleteFlag(flagKey)}
              onEdit={() => handleEditFlag(flagKey)}
              onActivateToggle={() => handleActivateToggle(flagKey)}
              onAddSegment={() => handleAddSegment(flagKey)}
              onDeleteSegment={id => handleDeleteSegment(flagKey, id)}
              onEditSegment={id => handleEditSegment(flagKey, id)}
              hasAccess={hasAccess}
              onSortEvaluations={({reorderedItems}) =>
                handleSortEvaluations(flagKey, reorderedItems)
              }
            />
          ))
        )}
      </Fragment>
    </SentryDocumentTitle>
  );
}
