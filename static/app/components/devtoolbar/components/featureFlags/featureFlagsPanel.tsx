import {useRef, useState} from 'react';

import useEnabledFeatureFlags from 'sentry/components/devtoolbar/components/featureFlags/useEnabledFeatureFlags';
import {inlineLinkCss} from 'sentry/components/devtoolbar/styles/link';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Input from 'sentry/components/input';
import ExternalLink from 'sentry/components/links/externalLink';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {Cell} from 'sentry/components/replays/virtualizedGrid/bodyCell';

import useConfiguration from '../../hooks/useConfiguration';
import {panelInsetContentCss, panelSectionCss} from '../../styles/panel';
import {smallCss} from '../../styles/typography';
import PanelLayout from '../panelLayout';

export default function FeatureFlagsPanel() {
  const featureFlags = useEnabledFeatureFlags();
  const {organizationSlug, featureFlagTemplateUrl, trackAnalytics} = useConfiguration();
  const [searchTerm, setSearchTerm] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);

  const filteredItems = featureFlags
    ?.filter(s => s.toLowerCase().includes(searchTerm))
    .sort();

  return (
    <PanelLayout title="Feature Flags">
      <div css={[smallCss, panelSectionCss, panelInsetContentCss]}>
        <span>Flags enabled for {organizationSlug}</span>
      </div>
      <PanelTable
        headers={[
          <div key="column">
            <Input
              ref={searchInput}
              size="sm"
              placeholder="Search flags"
              onChange={e => setSearchTerm(e.target.value.toLowerCase())}
            />
          </div>,
        ]}
        stickyHeaders
        css={[
          {
            border: 'none',
            padding: 0,
            '&>:first-child': {
              minHeight: 'unset',
              padding: 'var(--space50) var(--space150)',
            },
          },
        ]}
      >
        {filteredItems?.length ? (
          filteredItems.map(flag => {
            return (
              <Cell key={flag} css={[panelInsetContentCss, {alignItems: 'flex-start'}]}>
                {featureFlagTemplateUrl?.(flag) ? (
                  <ExternalLink
                    css={[smallCss, inlineLinkCss]}
                    href={featureFlagTemplateUrl(flag)}
                    onClick={() => {
                      trackAnalytics?.({
                        eventKey: `devtoolbar.feature-flag-list.item.click`,
                        eventName: `devtoolbar: Click feature-flag-list item`,
                      });
                    }}
                  >
                    {flag}
                  </ExternalLink>
                ) : (
                  <span>{flag}</span>
                )}
              </Cell>
            );
          })
        ) : (
          <EmptyStateWarning small>No items to show</EmptyStateWarning>
        )}
      </PanelTable>
    </PanelLayout>
  );
}
