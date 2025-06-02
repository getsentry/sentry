import {useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import {AggregationKey} from 'sentry/utils/fields';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

const TOOLBAR_AGGREGATES = [
  {
    label: t('count'),
    value: AggregationKey.COUNT,
    textValue: 'count',
  },
  {
    label: t('sum'),
    value: AggregationKey.SUM,
    textValue: 'sum',
  },
];

interface LogsToolbarProps {
  numberTags?: TagCollection;
  stringTags?: TagCollection;
}

export function LogsToolbar({stringTags, numberTags}: LogsToolbarProps) {
  const [selected, setSelected] = useState(TOOLBAR_AGGREGATES[0]!.value);
  const [groupBy, setGroupBy] = useState('');
  const [sortBy, setSortBy] = useState(OurLogKnownFieldKey.TIMESTAMP as string);
  const [sortAscending, setSortAscending] = useState(false);
  return (
    <Container>
      <ToolbarItem>
        <SectionHeader>
          <Label>{t('Visualize')}</Label>
        </SectionHeader>
        <ToolbarSelectRow>
          <Select
            options={TOOLBAR_AGGREGATES}
            onChange={val => setSelected(val.value as AggregationKey)}
            value={selected}
          />
          <Select options={[{label: t('logs'), value: 'logs'}]} value="logs" disabled />
        </ToolbarSelectRow>
      </ToolbarItem>
      <ToolbarItem>
        <SectionHeader>
          <Label>{t('Group By')}</Label>
        </SectionHeader>
        <Select
          options={[
            {
              label: '\u2014',
              value: '',
              textValue: '\u2014',
            },
            ...Object.keys(stringTags ?? {}).map(key => ({
              label: key,
              value: key,
              textValue: key,
            })),
          ]}
          onChange={val => setGroupBy(val.value as string)}
          value={groupBy}
          searchable
          triggerProps={{style: {width: '100%'}}}
        />
      </ToolbarItem>
      <ToolbarItem>
        <SectionHeader>
          <Label>{t('Sort By')}</Label>
        </SectionHeader>
        <ToolbarSelectRow>
          <Select
            options={[
              ...Object.keys(stringTags ?? {}),
              ...Object.keys(numberTags ?? {}),
            ].map(key => ({
              label: key,
              value: key,
              textValue: key,
            }))}
            onChange={val => setSortBy(val.value as string)}
            value={sortBy}
            searchable
            triggerProps={{style: {width: '100%'}}}
          />
          <Select
            options={[
              {
                label: t('asc'),
                value: 'asc',
              },
              {
                label: t('desc'),
                value: 'desc',
              },
            ]}
            value={sortAscending ? 'asc' : 'desc'}
            onChange={val => setSortAscending(val.value === 'asc')}
            searchable
            triggerProps={{style: {width: '100%'}}}
          />
        </ToolbarSelectRow>
      </ToolbarItem>
    </Container>
  );
}

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  border-right: 1px solid ${p => p.theme.border};
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(2)};
  gap: ${space(2)};
  background-color: ${p => p.theme.background};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(2)} ${space(4)};
  }
`;

const SectionHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
`;

const Label = styled('h5')`
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.form.md.fontSize};
  margin: 0;
`;

const ToolbarItem = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: ${space(1)};
`;

const ToolbarSelectRow = styled('div')`
  display: grid;
  grid-template-columns: minmax(90px, auto) auto;
  gap: ${space(2)};
`;

const Select = styled(CompactSelect)`
  width: 100%;
  flex-grow: 1;

  > button {
    width: 100%;
  }
`;
