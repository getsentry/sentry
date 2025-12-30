import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {Badge} from '@sentry/scraps/badge/badge';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconTable} from 'sentry/icons/iconTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Confidence} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';
import {AttributeBreakdownsContent} from 'sentry/views/explore/components/attributeBreakdowns/content';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import type {TracesTableResult} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import {
  useQueryParamsAggregateFields,
  useQueryParamsFields,
  useSetQueryParamsAggregateFields,
  useSetQueryParamsFields,
} from 'sentry/views/explore/queryParams/context';
import {AggregateColumnEditorModal} from 'sentry/views/explore/tables/aggregateColumnEditorModal';
import {AggregatesTable} from 'sentry/views/explore/tables/aggregatesTable';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import {SpansTable} from 'sentry/views/explore/tables/spansTable';
import {TracesTable} from 'sentry/views/explore/tables/tracesTable/index';

interface BaseExploreTablesProps {
  confidences: Confidence[];
  setTab: (tab: Mode | Tab) => void;
  tab: Mode | Tab;
}

interface ExploreTablesProps extends BaseExploreTablesProps {
  aggregatesTableResult: AggregatesTableResult;
  spansTableResult: SpansTableResult;
  tracesTableResult: TracesTableResult;
}

export function ExploreTables(props: ExploreTablesProps) {
  const organization = useOrganization();

  const aggregateFields = useQueryParamsAggregateFields();
  const setAggregateFields = useSetQueryParamsAggregateFields();

  const fields = useQueryParamsFields();
  const setFields = useSetQueryParamsFields();

  const {tags: numberTags} = useTraceItemTags('number');
  const {tags: stringTags} = useTraceItemTags('string');

  const attributeBreakdownsEnabled = organization.features.includes(
    'performance-spans-suspect-attributes'
  );

  const openColumnEditor = useCallback(() => {
    openModal(
      modalProps => (
        <ColumnEditorModal
          {...modalProps}
          columns={fields}
          onColumnsChange={setFields}
          stringTags={stringTags}
          numberTags={numberTags}
        />
      ),
      {closeEvents: 'escape-key'}
    );
  }, [fields, setFields, stringTags, numberTags]);

  const openAggregateColumnEditor = useCallback(() => {
    openModal(
      modalProps => (
        <AggregateColumnEditorModal
          {...modalProps}
          columns={aggregateFields.slice()}
          onColumnsChange={setAggregateFields}
          stringTags={stringTags}
          numberTags={numberTags}
        />
      ),
      {closeEvents: 'escape-key'}
    );
  }, [aggregateFields, setAggregateFields, stringTags, numberTags]);

  return (
    <Fragment>
      <SamplesTableHeader>
        <Tabs value={props.tab} onChange={props.setTab} size="sm">
          <TabList variant="floating">
            <TabList.Item key={Tab.SPAN}>{t('Span Samples')}</TabList.Item>
            <TabList.Item key={Tab.TRACE}>{t('Trace Samples')}</TabList.Item>
            <TabList.Item key={Mode.AGGREGATE}>{t('Aggregates')}</TabList.Item>
            {attributeBreakdownsEnabled ? (
              <TabList.Item key={Tab.ATTRIBUTE_BREAKDOWNS}>
                {t('Attribute Breakdowns')}
                <Badge variant="beta">Beta</Badge>
              </TabList.Item>
            ) : null}
          </TabList>
        </Tabs>
        {props.tab === Tab.SPAN ? (
          <Button onClick={openColumnEditor} icon={<IconTable />} size="sm">
            {t('Edit Table')}
          </Button>
        ) : props.tab === Mode.AGGREGATE ? (
          <Button onClick={openAggregateColumnEditor} icon={<IconTable />} size="sm">
            {t('Edit Table')}
          </Button>
        ) : (
          <Tooltip
            title={
              props.tab === Tab.TRACE
                ? t('Editing columns is available for span samples only')
                : t('Use the Group By and Visualize controls to change table columns')
            }
          >
            <Button disabled onClick={openColumnEditor} icon={<IconTable />} size="sm">
              {t('Edit Table')}
            </Button>
          </Tooltip>
        )}
      </SamplesTableHeader>
      {props.tab === Tab.SPAN && <SpansTable {...props} />}
      {props.tab === Tab.TRACE && <TracesTable {...props} />}
      {props.tab === Mode.AGGREGATE && <AggregatesTable {...props} />}
      {props.tab === Tab.ATTRIBUTE_BREAKDOWNS && <AttributeBreakdownsContent />}
    </Fragment>
  );
}

const SamplesTableHeader = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;
