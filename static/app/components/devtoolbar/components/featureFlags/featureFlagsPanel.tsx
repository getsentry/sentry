import {type Dispatch, Fragment, type SetStateAction, useState} from 'react';

import {Button} from 'sentry/components/button';
import {resetButtonCss, resetFlexRowCss} from 'sentry/components/devtoolbar/styles/reset';
import Input from 'sentry/components/input';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {IconAdd, IconClose} from 'sentry/icons';

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
            aria-label="Add Flag Override"
            css={[resetButtonCss, panelHeadingRightCss]}
            title="Add Flag Override"
            onClick={() => setIsAddFlagActive(!isAddFlagActive)}
          >
            <span css={buttonRightCss}>
              <IconAdd size="xs" />
              Add Flag
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
    <div css={[smallCss, panelSectionCss, panelInsetContentCss]}>
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
        disableHeaders
        css={[
          panelSectionCss,
          {
            flexGrow: 1,
            margin: 0,
            borderRadius: 0,
            border: 'none',
            padding: 0,
            '& > :first-child': {
              minHeight: 'unset',
              padding: 'var(--space50) var(--space150)',
            },
          },
        ]}
        headers={[undefined, undefined]}
        stickyHeaders
      >
        {names?.map(name => (
          <AnalyticsProvider key={name} keyVal="flag-item" nameVal="Flag Item">
            <FeatureFlagItem flag={{name, ...filtered[name]}} />
          </AnalyticsProvider>
        ))}
      </PanelTable>
      {prefilter === 'overrides' && (
        <Button
          size="xs"
          onClick={() => {
            clearOverrides();
          }}
        >
          <span css={[resetFlexRowCss, {gap: 'var(--space75)', alignItems: 'center'}]}>
            <IconClose isCircled size="xs" /> Remove all
          </span>
        </Button>
      )}
    </span>
  );
}
