import {type Dispatch, Fragment, type SetStateAction, useState} from 'react';
import {css} from '@emotion/react';

import {resetButtonCss, resetFlexRowCss} from 'sentry/components/devtoolbar/styles/reset';
import Input from 'sentry/components/input';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {IconChevron, IconClose} from 'sentry/icons';

import {
  buttonRightCss,
  panelHeadingRightCss,
  panelInsetContentCss,
  panelSectionCss,
  panelSectionCssNoBorder,
} from '../../styles/panel';
import {smallCss} from '../../styles/typography';
import AnalyticsProvider from '../analyticsProvider';
import PanelLayout from '../panelLayout';

import CustomOverride from './customOverride';
import FeatureFlagItem from './featureFlagItem';
import {FeatureFlagsContextProvider, useFeatureFlagsContext} from './featureFlagsContext';

type Prefilter = 'all' | 'overrides';

export default function FeatureFlagsPanel() {
  const [prefilter, setPrefilter] = useState<Prefilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddFlagActive, setIsAddFlagActive] = useState(false);

  return (
    <FeatureFlagsContextProvider>
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
              {background: 'var(--surface200)', padding: 'var(--space150)'},
            ]}
          >
            <AnalyticsProvider keyVal="custom-override" nameVal="Custom Override">
              <CustomOverride setComponentActive={setIsAddFlagActive} />
            </AnalyticsProvider>
          </div>
        )}
        <div css={{display: 'grid', gridTemplateRows: 'auto auto 1fr auto', flexGrow: 1}}>
          <IsDirtyMessage />
          <div
            css={[
              smallCss,
              panelSectionCssNoBorder,
              panelInsetContentCss,
              {
                display: 'grid',
                gridTemplateAreas: "'search segments'",
                gap: 'var(--space100)',
              },
            ]}
          >
            <Filters
              setPrefilter={setPrefilter}
              prefilter={prefilter}
              setSearchTerm={setSearchTerm}
            />
          </div>
          <div
            css={[{contain: 'strict', flexDirection: 'column', alignItems: 'stretch'}]}
          >
            <div css={{overflow: 'auto'}}>
              <AnalyticsProvider keyVal="flag-table" nameVal="Flag Table">
                <FlagTable searchTerm={searchTerm} prefilter={prefilter} />
              </AnalyticsProvider>
            </div>
          </div>
        </div>
      </PanelLayout>
    </FeatureFlagsContextProvider>
  );
}

function IsDirtyMessage() {
  const {isDirty} = useFeatureFlagsContext();

  return isDirty ? (
    <div
      css={[smallCss, panelSectionCss, panelInsetContentCss, {color: 'var(--gray300)'}]}
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
      <div css={{gridArea: 'segments'}}>
        <SegmentedControl<Prefilter> onChange={setPrefilter} size="xs" value={prefilter}>
          <SegmentedControl.Item key="all">All</SegmentedControl.Item>
          <SegmentedControl.Item key="overrides">Overrides</SegmentedControl.Item>
        </SegmentedControl>
      </div>
      <Input
        css={{gridArea: 'search'}}
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
        css={[
          {
            flexGrow: 1,
            margin: 0,
            borderRadius: 0,
            border: 'none',
            padding: 0,
            '& > :first-child': {
              minHeight: 'unset',
            },
          },
        ]}
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
            {display: 'block', textAlign: 'center', color: 'var(--gray300)'},
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
            {display: 'block', textAlign: 'center'},
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
                {
                  gap: 'var(--space75)',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
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
