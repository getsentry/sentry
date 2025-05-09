import {type Dispatch, Fragment, type SetStateAction, useState} from 'react';
import {css} from '@emotion/react';

import {Input} from 'sentry/components/core/input';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import AnalyticsProvider from 'sentry/components/devtoolbar/components/analyticsProvider';
import PanelLayout from 'sentry/components/devtoolbar/components/panelLayout';
import {
  buttonRightCss,
  panelHeadingRightCss,
  panelInsetContentCss,
  panelSectionCss,
  panelSectionCssNoBorder,
} from 'sentry/components/devtoolbar/styles/panel';
import {resetButtonCss, resetFlexRowCss} from 'sentry/components/devtoolbar/styles/reset';
import {smallCss} from 'sentry/components/devtoolbar/styles/typography';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {IconChevron, IconClose} from 'sentry/icons';

import CustomOverride from './customOverride';
import FeatureFlagItem from './featureFlagItem';
import {useFeatureFlagsContext} from './featureFlagsContext';
import FlagOverridesBadge from './flagOverridesBadge';

type Prefilter = 'all' | 'overrides';

export default function FeatureFlagsPanel() {
  const [prefilter, setPrefilter] = useState<Prefilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddFlagActive, setIsAddFlagActive] = useState(false);

  return (
    <PanelLayout
      title="Feature Flags"
      titleRight={
        <button
          aria-label="Override Flag"
          css={[resetButtonCss, panelHeadingRightCss]}
          title="Override Flag"
          onClick={() => setIsAddFlagActive(!isAddFlagActive)}
        >
          <span css={buttonRightCss}>
            {isAddFlagActive ? (
              <IconChevron direction="up" size="xs" />
            ) : (
              <IconChevron direction="down" size="xs" />
            )}
            Override
          </span>
        </button>
      }
    >
      {isAddFlagActive && (
        <div
          css={[
            smallCss,
            panelSectionCss,
            panelInsetContentCss,
            css`
              background: var(--surface200);
              padding: var(--space150);
            `,
          ]}
        >
          <AnalyticsProvider keyVal="custom-override" nameVal="Custom Override">
            <CustomOverride setComponentActive={setIsAddFlagActive} />
          </AnalyticsProvider>
        </div>
      )}
      <div
        css={css`
          display: grid;
          grid-template-rows: auto auto 1fr auto;
          flex-grow: 1;
        `}
      >
        <IsDirtyMessage />
        <div
          css={[
            smallCss,
            panelSectionCssNoBorder,
            panelInsetContentCss,
            css`
              display: grid;
              grid-template-areas: 'search segments';
              gap: var(--space100);
            `,
          ]}
        >
          <Filters
            setPrefilter={setPrefilter}
            prefilter={prefilter}
            setSearchTerm={setSearchTerm}
          />
        </div>
        <div
          css={css`
            contain: strict;
            flex-direction: column;
            align-items: stretch;
          `}
        >
          <div
            css={css`
              overflow: auto;
            `}
          >
            <AnalyticsProvider keyVal="flag-table" nameVal="Flag Table">
              <FlagTable searchTerm={searchTerm} prefilter={prefilter} />
            </AnalyticsProvider>
          </div>
        </div>
      </div>
    </PanelLayout>
  );
}

function IsDirtyMessage() {
  const {isDirty} = useFeatureFlagsContext();

  return isDirty ? (
    <div
      css={[
        smallCss,
        panelSectionCss,
        panelInsetContentCss,
        css`
          color: var(--gray300);
        `,
      ]}
    >
      <span>Reload to see changes</span>
    </div>
  ) : (
    <div />
  );
}

function Filters({
  setPrefilter,
  prefilter,
  setSearchTerm,
}: {
  prefilter: Prefilter;
  setPrefilter: Dispatch<SetStateAction<Prefilter>>;
  setSearchTerm: Dispatch<SetStateAction<string>>;
}) {
  return (
    <Fragment>
      <div
        css={css`
          grid-area: segments;
        `}
      >
        <div
          css={css`
            position: relative;
            display: grid;
          `}
        >
          <SegmentedControl<Prefilter>
            onChange={setPrefilter}
            size="xs"
            value={prefilter}
          >
            <SegmentedControl.Item key="all">All</SegmentedControl.Item>
            <SegmentedControl.Item key="overrides">Overrides</SegmentedControl.Item>
          </SegmentedControl>
          <FlagOverridesBadge />
        </div>
      </div>
      <Input
        css={css`
          grid-area: search;
        `}
        onChange={e => setSearchTerm(e.target.value.toLowerCase())}
        placeholder="Search"
        size="xs"
      />
    </Fragment>
  );
}

function FlagTable({prefilter, searchTerm}: {prefilter: Prefilter; searchTerm: string}) {
  const {featureFlagMap, clearOverrides} = useFeatureFlagsContext();

  const filtered = Object.fromEntries(
    Object.entries(featureFlagMap)?.filter(([name, {value, override}]) => {
      const overrideOnly = prefilter === 'overrides';
      const isOverridden = override !== undefined && value !== override;
      const matchesSearch = name
        .toLocaleLowerCase()
        .includes(searchTerm.toLocaleLowerCase());
      return overrideOnly ? isOverridden && matchesSearch : matchesSearch;
    })
  );
  const names = Object.keys(filtered).sort();

  return (
    <span>
      <PanelTable
        disablePadding
        disableHeaders
        css={css`
          flex-grow: 1;
          margin: 0;
          border-radius: 0;
          border: none;
          padding: 0;
          & > :first-child {
            min-height: unset;
          }
        `}
        headers={[undefined, undefined]}
        stickyHeaders
      >
        {names?.map(name => (
          <AnalyticsProvider key={name} keyVal="flag-item" nameVal="Flag Item">
            <FeatureFlagItem flag={{name, ...filtered[name]!}} />
          </AnalyticsProvider>
        ))}
      </PanelTable>
      {!names.length && (
        <div
          css={[
            smallCss,
            panelSectionCssNoBorder,
            panelInsetContentCss,
            css`
              display: block;
              text-align: center;
              color: var(--gray300);
            `,
          ]}
        >
          No flags to display
        </div>
      )}
      {prefilter === 'overrides' && Boolean(names.length) && (
        <div
          css={[
            smallCss,
            panelSectionCssNoBorder,
            panelInsetContentCss,
            css`
              display: block;
              text-align: center;
            `,
          ]}
        >
          <button
            css={[
              resetButtonCss,
              css`
                width: 100%;
              `,
            ]}
            onClick={() => {
              clearOverrides();
            }}
          >
            <span
              css={[
                resetFlexRowCss,
                css`
                  gap: var(--space75);
                  align-items: center;
                  justify-content: center;
                `,
              ]}
            >
              <IconClose isCircled size="xs" /> Remove All
            </span>
          </button>
        </div>
      )}
    </span>
  );
}
