import {useContext, useState} from 'react';

import AnalyticsProvider, {
  AnalyticsContext,
} from 'sentry/components/devtoolbar/components/analyticsProvider';
import ExternalLink from 'sentry/components/links/externalLink';
import {Cell} from 'sentry/components/replays/virtualizedGrid/bodyCell';
import Switch from 'sentry/components/switchButton';

import useConfiguration from '../../hooks/useConfiguration';
import {inlineLinkCss} from '../../styles/link';
import {panelInsetContentCss} from '../../styles/panel';
import {smallCss} from '../../styles/typography';
import type {FlagValue} from '../../types';

import {useFeatureFlagsContext} from './featureFlagsContext';

type FeatureFlag = {name: string; override: FlagValue; value: FlagValue};

export default function FeatureFlagItem({flag}: {flag: FeatureFlag}) {
  const {featureFlags} = useConfiguration();

  return (
    <AnalyticsProvider nameVal="item" keyVal="item">
      <Cell css={[panelInsetContentCss, {alignItems: 'flex-start'}]}>
        {featureFlags?.urlTemplate?.(flag.name) ? (
          <ExternalLink
            css={[smallCss, inlineLinkCss]}
            href={featureFlags.urlTemplate(flag.name)}
          >
            {flag.name}
          </ExternalLink>
        ) : (
          <span>{flag.name}</span>
        )}
      </Cell>
      <Cell>
        <FlagValueInput flag={flag} />
      </Cell>
    </AnalyticsProvider>
  );
}

function FlagValueInput({flag}: {flag: FeatureFlag}) {
  if (
    typeof flag.value === 'boolean' ||
    flag.override === true ||
    flag.override === false
  ) {
    return <FlagValueBooleanInput flag={flag} />;
  }

  return (
    <code>
      {flag.override !== undefined ? String(flag.override) : String(flag.value)}
    </code>
  );
}

function FlagValueBooleanInput({flag}: {flag: FeatureFlag}) {
  const {featureFlags, trackAnalytics} = useConfiguration();
  const {eventName, eventKey} = useContext(AnalyticsContext);

  const {hasOverride} = useFeatureFlagsContext();

  const [isActive, setState] = useState(
    flag.override !== undefined ? Boolean(flag.override) : Boolean(flag.value)
  );

  return (
    <label
      htmlFor="mask"
      css={{
        display: 'flex',
        alignItems: 'flex-end',
        alignSelf: 'flex-end',
        gap: 'var(--space100)',
      }}
    >
      <code>{String(isActive)}</code>
      <Switch
        isActive={isActive}
        toggle={() => {
          featureFlags?.setOverrideValue?.(flag.name, !isActive);
          setState(!isActive);
          hasOverride();
          trackAnalytics?.({
            eventKey: eventKey + '.override.click',
            eventName: eventName + ' override clicked',
          });
        }}
      />
    </label>
  );
}
