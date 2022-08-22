import {Fragment, useState} from 'react';

import Button from 'sentry/components/button';
import FeatureBadge from 'sentry/components/featureBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t, tct} from 'sentry/locale';
import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {Card} from './card';

const initalState = {
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

type Props = {
  project: Project;
};

export default function FeatureFlags({project}: Props) {
  const [state, setState] = useState<typeof initalState>(initalState);
  const organization = useOrganization();

  const flags = Object.keys(state);
  const disabled = !organization.access.includes('project:write');

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
            <Button
              title={disabled ? t('You do not have permission to add flags') : undefined}
              priority="primary"
              size="sm"
              icon={<IconAdd size="xs" isCircled />}
              onClick={() => {}}
              disabled={disabled}
            >
              {t('Add Flag')}
            </Button>
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
        {!flags.length ? (
          <div>oi</div>
        ) : (
          flags.map(flag => (
            <Card key={flag} name={flag} {...state[flag]} onEnable={() => {}} />
          ))
        )}
      </Fragment>
    </SentryDocumentTitle>
  );
}
