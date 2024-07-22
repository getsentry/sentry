import {useRef, useState} from 'react';

import useEnabledFeatureFlags from 'sentry/components/devtoolbar/components/featureFlags/useEnabledFeatureFlags';
import {
  infiniteListScrollableWindowCss,
  panelScrollableCss,
} from 'sentry/components/devtoolbar/styles/infiniteList';
import Input from 'sentry/components/input';
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
  const [searchTerm, setSearchTerm] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);

  return (
    <PanelLayout title="Feature Flags">
      <div css={[smallCss, panelSectionCss, panelInsetContentCss]}>
        <Input
          ref={searchInput}
          size="sm"
          placeholder="Search flags"
          onChange={e => setSearchTerm(e.target.value.toLowerCase())}
        />
      </div>

      <PanelTable
        headers={[<span key="Flags">Flags enabled for {organizationSlug}</span>]}
        css={[resetFlexColumnCss, infiniteListScrollableWindowCss, panelScrollableCss]}
      >
        {featureFlags
          ?.filter(s => s.toLowerCase().includes(searchTerm))
          .sort()
          .map(flag => {
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
