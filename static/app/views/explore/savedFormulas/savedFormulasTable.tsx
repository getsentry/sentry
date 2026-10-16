import {Fragment} from 'react';

import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import {openConfirmModal} from 'sentry/components/confirm';
import {SavedEntityTable} from 'sentry/components/savedEntityTable';
import {t} from 'sentry/locale';
import {useDeleteFormula} from 'sentry/views/explore/hooks/useDeleteFormula';
import type {
  FormulaDataset,
  SavedFormula,
} from 'sentry/views/explore/hooks/useGetSavedFormulas';
import {stripNamePrefix} from 'sentry/views/explore/savedFormulas/formulaBuilder/draft';
import {useFormulaBuilderUrl} from 'sentry/views/explore/savedFormulas/formulaBuilderUrl';
import {
  buildTokenMap,
  FormulaToken,
  FormulaTokens,
} from 'sentry/views/explore/savedFormulas/formulaTokens';

const DATASET_LABEL_MAP: Record<FormulaDataset, string> = {
  spans: t('Spans'),
  logs: t('Logs'),
  metrics: t('Metrics'),
};

const COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(200px, 2fr)'},
  {key: 'dataset', width: 'max-content'},
  {key: 'unit', visible: {xl: true}, width: 'max-content'},
  {key: 'params', visible: {xl: true}, width: 'max-content'},
  {key: 'formula', width: 'minmax(0, 3fr)'},
  {key: 'created-by', width: 'min-content'},
  {key: 'actions', width: '48px'},
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
          <SavedEntityTable.HeaderCell>{t('Parameters')}</SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell>{t('Formula')}</SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell>{t('Creator')}</SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell />
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
  const makeBuilderUrl = useFormulaBuilderUrl();
  const {deleteFormula} = useDeleteFormula();
  const name = stripNamePrefix(formula.name);

  function confirmDelete() {
    openConfirmModal({
      message: t('Are you sure you want to delete the formula "%s"?', name),
      isDangerous: true,
      confirmText: t('Delete Formula'),
      priority: 'danger',
      onConfirm: async () => {
        addLoadingMessage(t('Deleting formula...'));
        try {
          await deleteFormula(formula.id);
          addSuccessMessage(t('Formula deleted'));
        } catch {
          addErrorMessage(t('Unable to delete formula'));
        }
      },
    });
  }

  return (
    <SavedEntityTable.Row isFirst={isFirst}>
      <SavedEntityTable.Cell>
        <SavedEntityTable.CellName to={makeBuilderUrl(formula.id)} title={name}>
          {name}
        </SavedEntityTable.CellName>
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
        <SavedEntityTable.CellTextContent>
          <Text monospace size="sm">
            {formula.params
              .filter(param => param.type !== 'calculation')
              .map((param, index) => (
                <Fragment key={param.name}>
                  {index > 0 && ', '}
                  <FormulaToken kind="parameter">{param.name}</FormulaToken>
                </Fragment>
              ))}
          </Text>
        </SavedEntityTable.CellTextContent>
      </SavedEntityTable.Cell>
      <SavedEntityTable.Cell>
        <Tooltip title={formula.formula} showOnlyOnOverflow skipWrapper>
          <SavedEntityTable.CellTextContent>
            <Text monospace size="sm">
              <FormulaTokens
                expression={formula.formula}
                tokens={buildTokenMap(formula)}
              />
            </Text>
          </SavedEntityTable.CellTextContent>
        </Tooltip>
      </SavedEntityTable.Cell>
      <SavedEntityTable.Cell justify="center">
        {formula.prebuilt ? (
          <Tooltip title="Sentry">
            <ActivityAvatar type="system" size={20} />
          </Tooltip>
        ) : null}
      </SavedEntityTable.Cell>
      <SavedEntityTable.Cell hasButton>
        <SavedEntityTable.CellActions
          items={[
            {
              key: 'delete',
              label: t('Delete'),
              priority: 'danger',
              onAction: confirmDelete,
            },
          ]}
        />
      </SavedEntityTable.Cell>
    </SavedEntityTable.Row>
  );
}
