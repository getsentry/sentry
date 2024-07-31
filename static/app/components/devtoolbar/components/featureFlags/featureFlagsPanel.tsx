import {type Dispatch, Fragment, type SetStateAction, useState} from 'react';

import {Button} from 'sentry/components/button';
import Input from 'sentry/components/input';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {SegmentedControl} from 'sentry/components/segmentedControl';

import {panelInsetContentCss, panelSectionCss} from '../../styles/panel';
import {resetFlexRowCss} from '../../styles/reset';
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

  return (
    <FeatureFlagsContextProvider>
      <PanelLayout title="Feature Flags">
        <div css={{display: 'grid', gridTemplateRows: 'auto auto 1fr auto', flexGrow: 1}}>
          <IsDirtyMessage />
          <div
            css={[
              smallCss,
              panelSectionCss,
              panelInsetContentCss,
              {
                display: 'grid',
                gridTemplateAreas: "'segments clear' 'search search'",
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
          <div css={[resetFlexRowCss, {contain: 'strict'}]}>
            <AnalyticsProvider keyVal="flag-table" nameVal="Flag Table">
              <FlagTable searchTerm={searchTerm} prefilter={prefilter} />
            </AnalyticsProvider>
          </div>
          <div css={[smallCss, panelSectionCss, panelInsetContentCss]}>
            <AnalyticsProvider keyVal="custom-override" nameVal="Custom Override">
              <CustomOverride />
            </AnalyticsProvider>
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
  const {clearOverrides} = useFeatureFlagsContext();
  return (
    <Fragment>
      <div css={{gridArea: 'segments'}}>
        <SegmentedControl<Prefilter> onChange={setPrefilter} size="xs" value={prefilter}>
          <SegmentedControl.Item key="all">All Flags</SegmentedControl.Item>
          <SegmentedControl.Item key="overrides">Overrides Only</SegmentedControl.Item>
        </SegmentedControl>
      </div>
      <Button
        size="xs"
        onClick={() => {
          clearOverrides();
        }}
        css={{gridArea: 'clear'}}
      >
        Clear Overrides
      </Button>
      <Input
        css={{gridArea: 'search'}}
        onChange={e => setSearchTerm(e.target.value.toLowerCase())}
        placeholder="Search flags"
        size="xs"
      />
    </Fragment>
  );
}

function FlagTable({prefilter, searchTerm}: {prefilter: string; searchTerm: string}) {
  const {featureFlagMap} = useFeatureFlagsContext();

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
    <PanelTable
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
      headers={[
        <Fragment key="name">Name</Fragment>,
        <Fragment key="value">Value</Fragment>,
      ]}
      stickyHeaders
    >
      {names?.map(name => (
        <AnalyticsProvider key={name} keyVal="flag-item" nameVal="Flag Item">
          <FeatureFlagItem flag={{name, ...filtered[name]}} />
        </AnalyticsProvider>
      ))}
    </PanelTable>
  );
}
