import {InfoText} from '@sentry/scraps/info';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import {SavedEntityTable} from 'sentry/components/savedEntityTable';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import type {
  FormulaDataset,
  SavedFormula,
} from 'sentry/views/explore/hooks/useGetSavedFormulas';

const DATASET_LABEL_MAP: Record<FormulaDataset, string> = {
  spans: t('Spans'),
  logs: t('Logs'),
  metrics: t('Metrics'),
};

const COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(200px, 2fr)'},
  {key: 'dataset', width: 'max-content'},
  {key: 'unit', visible: {xl: true}, width: 'max-content'},
  {key: 'created-by', width: '48px'},
];

type Props = {
  formulas: SavedFormula[] | undefined;
  isError: boolean;
  isPending: boolean;
};

export function SavedFormulasTable({formulas, isError, isPending}: Props) {
  return (
    <SavedEntityTable
      columns={COLUMNS}
      isLoading={isPending}
      isError={isError}
      isEmpty={formulas?.length === 0}
      emptyMessage={t('No saved formulas found')}
      header={
        <SavedEntityTable.Header>
          <SavedEntityTable.HeaderCell divider={false}>
            {t('Name')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell>{t('Dataset')}</SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell>{t('Unit')}</SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell>{t('Creator')}</SavedEntityTable.HeaderCell>
        </SavedEntityTable.Header>
      }
    >
      {formulas?.map((formula, index) => (
        <FormulaRow key={formula.id} formula={formula} isFirst={index === 0} />
      ))}
    </SavedEntityTable>
  );
}

function FormulaRow({formula, isFirst}: {formula: SavedFormula; isFirst: boolean}) {
  return (
    <SavedEntityTable.Row isFirst={isFirst}>
      <SavedEntityTable.Cell>
        <InfoText title={formula.name} mode="overflowOnly" monospace>
          {formula.name}
        </InfoText>
      </SavedEntityTable.Cell>
      <SavedEntityTable.Cell>
        <SavedEntityTable.CellTextContent>
          {DATASET_LABEL_MAP[formula.dataset]}
        </SavedEntityTable.CellTextContent>
      </SavedEntityTable.Cell>
      <SavedEntityTable.Cell>
        <SavedEntityTable.CellTextContent>
          {formula.unit ?? formula.type}
        </SavedEntityTable.CellTextContent>
      </SavedEntityTable.Cell>
      <SavedEntityTable.Cell>
        {defined(formula.prebuiltId) ? (
          <Tooltip title="Sentry">
            <ActivityAvatar type="system" size={20} />
          </Tooltip>
        ) : null}
      </SavedEntityTable.Cell>
    </SavedEntityTable.Row>
  );
}
