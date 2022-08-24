import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import FeatureBadge from 'sentry/components/featureBadge';
import CompactSelect from 'sentry/components/forms/compactSelect';
import ExternalLink from 'sentry/components/links/externalLink';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t, tct} from 'sentry/locale';
import ProjectStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
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
import {Promo} from './promo';

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
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(null);

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
    const newEvaluations = [...flags[flagKey].evaluation];
    newEvaluations.splice(index, 1);

    const newFeatureFlags = {...flags};
    newFeatureFlags[flagKey].evaluation = newEvaluations;

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

  async function handleSortSegments(flagKey: string, segmentIds: string[]) {
    const sortedSegments = segmentIds
      .map(segmentId =>
        flags[flagKey].evaluation.find(segment => String(segment.id) === segmentId)
      )
      .filter(defined);

    const newFeatureFlags = {...flags};
    newFeatureFlags[flagKey].evaluation = sortedSegments;

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

  const filteredFlags = Object.keys(flags).filter(key => {
    return (
      key.toLowerCase().includes(query.toLowerCase()) &&
      (status === null || flags[key].enabled === status)
    );
  });

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
          <Promo hasAccess={hasAccess} onGetStarted={handleAddFlag} />
        ) : (
          <Content>
            <Filters>
              <SearchBar
                size="md"
                onChange={setQuery}
                query={query}
                placeholder={t('Search by flag name')}
              />
              <CompactSelect
                defaultValue={status}
                options={[
                  {value: null, label: t('All')},
                  {value: true, label: t('Active')},
                  {value: false, label: t('Inactive')},
                ]}
                value={status}
                onChange={value => setStatus(value.value)}
                triggerProps={{prefix: t('Status'), style: {width: '100%'}}}
              />
            </Filters>
            {!filteredFlags.length ? (
              <EmptyStateWarning>
                <p>{t('Sorry, no feature flag match your filters')}</p>
              </EmptyStateWarning>
            ) : (
              <div>
                {filteredFlags.map(filteredFlag => (
                  <Card
                    key={filteredFlag}
                    flagKey={filteredFlag}
                    kind={flags[filteredFlag].kind}
                    enabled={flags[filteredFlag].enabled}
                    description={flags[filteredFlag].description}
                    segments={flags[filteredFlag].evaluation}
                    onDelete={() => handleDeleteFlag(filteredFlag)}
                    onEdit={() => handleEditFlag(filteredFlag)}
                    onActivateToggle={() => handleActivateToggle(filteredFlag)}
                    onAddSegment={() => handleAddSegment(filteredFlag)}
                    onDeleteSegment={id => handleDeleteSegment(filteredFlag, id)}
                    onEditSegment={id => handleEditSegment(filteredFlag, id)}
                    hasAccess={hasAccess}
                    onSortSegments={({reorderedItems}) =>
                      handleSortSegments(filteredFlag, reorderedItems)
                    }
                  />
                ))}
              </div>
            )}
          </Content>
        )}
      </Fragment>
    </SentryDocumentTitle>
  );
}

const Content = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

const Filters = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: 1fr max-content;
`;
