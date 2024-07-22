import useEnabledFeatureFlags from 'sentry/components/devtoolbar/components/featureFlags/useEnabledFeatureFlags';
import {
  infiniteListScrollableWindowCss,
  panelScrollableCss,
} from 'sentry/components/devtoolbar/styles/infiniteList';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {Cell} from 'sentry/components/replays/virtualizedGrid/bodyCell';

import useConfiguration from '../../hooks/useConfiguration';
import {panelInsetContentCss, panelSectionCss} from '../../styles/panel';
import {resetFlexColumnCss} from '../../styles/reset';
import {smallCss} from '../../styles/typography';
import PanelLayout from '../panelLayout';

export default function FeatureFlagsPanel() {
  const featureFlags = useEnabledFeatureFlags();
  const {organizationSlug} = useConfiguration();

  return (
    <PanelLayout title="Feature Flags">
      <div css={[smallCss, panelSectionCss, panelInsetContentCss]}>
        <span>
          Feature flags enabled for <code>{organizationSlug}</code>
        </span>
      </div>

      <PanelTable
        headers={['Flags']}
        css={[resetFlexColumnCss, infiniteListScrollableWindowCss, panelScrollableCss]}
      >
        {featureFlags?.sort().map(flag => {
          return (
            <Cell key={flag} style={{alignItems: 'flex-start'}}>
              {flag}
            </Cell>
          );
        })}
      </PanelTable>
    </PanelLayout>
  );
}
