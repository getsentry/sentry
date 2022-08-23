import {Fragment, useEffect, useState} from 'react';
import isEqual from 'lodash/isEqual';

import {ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import FeatureBadge from 'sentry/components/featureBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t, tct} from 'sentry/locale';
import {Project} from 'sentry/types';
import {FeatureFlags} from 'sentry/types/featureFlags';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/organization/permissionAlert';

import {FlagModal} from './modals/flagModal';
import {Card} from './card';
import {FeatureFlagsPromo} from './featureFlagsPromo';

const initalState: FeatureFlags = {
  accessToProfiling: {
    enabled: true,
    description: 'This is a description',
    evaluations: [
      {
        type: 'rollout',
        percentage: 0.5,
        result: true,
        tags: {
          userSegment: 'slow',
        },
      },
      {
        type: 'match',
        result: true,
        tags: {
          isSentryDev: 'true',
        },
      },
    ],
  },
  profilingEnabled: {
    enabled: false,
    evaluations: [
      {
        type: 'rollout',
        percentage: 0.05,
        result: true,
      },
      {
        type: 'match',
        result: true,
        tags: {
          isSentryDev: 'true',
        },
      },
    ],
  },
};

type Props = ModalRenderProps & {
  project: Project;
};

export default function ProjectFeatureFlags({project}: Props) {
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

  function handleDeleteFlag(flagKey: string) {
    // todo
  }

  function handleEnableFlag(flagKey: string) {
    // todo
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
              onEnable={() => handleEnableFlag(flagKey)}
            />
          ))
        )}
      </Fragment>
    </SentryDocumentTitle>
  );
}
