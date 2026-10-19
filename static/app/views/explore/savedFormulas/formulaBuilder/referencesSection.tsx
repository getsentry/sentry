import {useMemo} from 'react';
import {IconAdd} from '@sentry/icons/add';
import {IconDelete} from '@sentry/icons/delete';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {ExploreEquationArithmeticBuilder} from 'sentry/views/explore/components/exploreEquationArithmeticBuilder';
import type {FormulaDataset} from 'sentry/views/explore/hooks/useGetSavedFormulas';
import {useTraceItemDatasetAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {
  BuilderSection,
  FIELD_MAX_WIDTH,
} from 'sentry/views/explore/savedFormulas/formulaBuilder/builderSection';
import {
  newReference,
  type DraftParam,
  type DraftReference,
} from 'sentry/views/explore/savedFormulas/formulaBuilder/draft';
import {TraceItemDataset} from 'sentry/views/explore/types';

const TRACE_ITEM_DATASET_MAP: Record<FormulaDataset, TraceItemDataset> = {
  spans: TraceItemDataset.SPANS,
  logs: TraceItemDataset.LOGS,
  metrics: TraceItemDataset.TRACEMETRICS,
};

/**
 * Params are offered to the equation builder as number attributes so one can be
 * picked anywhere an attribute can. They're spread first so they lead the attribute
 * list rather than getting lost among the dataset's own attributes.
 */
function useParamAttributes(params: DraftParam[], traceItemType: TraceItemDataset) {
  const {attributes: numberAttributes} = useTraceItemDatasetAttributes(
    traceItemType,
    {},
    'number'
  );
  const {attributes: stringTags} = useTraceItemDatasetAttributes(
    traceItemType,
    {},
    'string'
  );
  const {attributes: booleanTags} = useTraceItemDatasetAttributes(
    traceItemType,
    {},
    'boolean'
  );

  const numberTags = useMemo(() => {
    const paramTags: TagCollection = Object.fromEntries(
      params
        .filter(param => param.name)
        .map(param => [
          param.name,
          {key: param.name, name: param.name, kind: FieldKind.MEASUREMENT},
        ])
    );
    return {...paramTags, ...numberAttributes};
  }, [params, numberAttributes]);

  return {numberTags, stringTags, booleanTags};
}

type Props = {
  dataset: FormulaDataset;
  onChange: (references: DraftReference[]) => void;
  params: DraftParam[];
  references: DraftReference[];
  disabled?: boolean;
};

export function ReferencesSection({
  dataset,
  params,
  references,
  onChange,
  disabled,
}: Props) {
  const traceItemType = TRACE_ITEM_DATASET_MAP[dataset];
  const {numberTags, stringTags, booleanTags} = useParamAttributes(params, traceItemType);

  function update(key: string, changes: Partial<DraftReference>) {
    onChange(
      references.map(reference =>
        reference.key === key ? {...reference, ...changes} : reference
      )
    );
  }

  return (
    <BuilderSection
      title={t('References')}
      description={t(
        'Named equations the formula combines. Parameters can be used anywhere an attribute can.'
      )}
    >
      <Stack gap="lg">
        {references.map(reference => (
          <Grid
            key={reference.key}
            columns="200px minmax(0, 1fr) max-content"
            align="center"
            gap="md"
            maxWidth={FIELD_MAX_WIDTH}
          >
            <Input
              value={reference.name}
              placeholder={t('Name')}
              aria-label={t('Reference name')}
              disabled={disabled}
              onChange={event => update(reference.key, {name: event.target.value})}
            />
            <ExploreEquationArithmeticBuilder
              expression={reference.value}
              setExpression={expression =>
                update(reference.key, {value: expression.text})
              }
              traceItemType={traceItemType}
              numberTags={numberTags}
              stringTags={stringTags}
              booleanTags={booleanTags}
              truncateArguments={false}
              disabled={disabled}
            />
            <Button
              variant="transparent"
              size="sm"
              icon={<IconDelete size="sm" />}
              aria-label={t('Remove reference')}
              disabled={disabled}
              onClick={() =>
                onChange(references.filter(other => other.key !== reference.key))
              }
            />
          </Grid>
        ))}
        <Flex>
          <Button
            size="sm"
            icon={<IconAdd />}
            disabled={disabled}
            onClick={() => onChange([...references, newReference()])}
          >
            {t('Add Reference')}
          </Button>
        </Flex>
      </Stack>
    </BuilderSection>
  );
}
