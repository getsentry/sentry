import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {AggregateSummary} from 'sentry/views/detectors/datasetConfig/base';

/**
 * Explains what each reference label (A, B, …) of a compact expression refers to.
 */
export function AggregateSummaryTable({summary}: {summary: AggregateSummary}) {
  // The table also renders into a static, `nowrap` chart tooltip, where a truncated
  // header could never show its full text, so cells wrap instead and columns never
  // shrink below their narrowest content.
  const columns: TableColumnConfig[] = [
    {key: 'label', width: 'max-content'},
    ...summary.headers.map(header => ({key: header, width: 'minmax(min-content, auto)'})),
  ];

  return (
    <SimpleTable
      aria-label={t('Aggregate summary')}
      columns={columns}
      density="compressed"
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell />
          {summary.headers.map(header => (
            // Chart tooltips force `div:first-of-type` to full width, which would
            // stretch each divider into a bar behind its header.
            <SimpleTable.HeaderCell key={header} divider={false}>
              <Text size="sm" variant="inherit" wrap="normal">
                {header}
              </Text>
            </SimpleTable.HeaderCell>
          ))}
        </SimpleTable.HeaderRow>
      }
    >
      {summary.components.map(component => (
        <SimpleTable.Row key={component.label}>
          <SimpleTable.RowCell alignSelf="start">
            <Text size="sm" bold align="left">
              {component.label}
            </Text>
          </SimpleTable.RowCell>
          {component.values.map((value, index) => (
            <SimpleTable.RowCell key={summary.headers[index]} alignSelf="start">
              <Text size="sm" align="left" wrap="normal" wordBreak="break-all">
                {value || '—'}
              </Text>
            </SimpleTable.RowCell>
          ))}
        </SimpleTable.Row>
      ))}
    </SimpleTable>
  );
}
