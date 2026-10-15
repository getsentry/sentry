import {uniqueId} from 'sentry/utils/guid';
import type {
  FormulaParam,
  FormulaParamType,
  SavedFormula,
} from 'sentry/views/explore/hooks/useGetSavedFormulas';
import type {SavedFormulaRequest} from 'sentry/views/explore/hooks/useSaveFormula';
import {
  addVariableBraces,
  stripVariableBraces,
} from 'sentry/views/explore/savedFormulas/formulaTokens';

/** Names are stored with this prefix so they can't collide with a built in function. */
export const NAME_PREFIX = 'formula.';

/** The API resolves params positionally, and only has four positions. */
export const MAX_PARAMS = 4;

/** Rows are keyed separately because a param has no name until one is typed in. */
export type DraftParam = Omit<FormulaParam, 'order'> & {key: string};

/**
 * What the builder edits. Names are held without their prefix, and param order
 * comes from the order of the rows.
 */
export type FormulaDraft = Omit<SavedFormulaRequest, 'name' | 'params'> & {
  name: string;
  params: DraftParam[];
  id?: string;
};

export function newParam(type: FormulaParamType): DraftParam {
  return {key: uniqueId(), name: '', type, value: ''};
}

export function toDraft(formula: SavedFormula | undefined): FormulaDraft {
  if (!formula) {
    return {
      name: '',
      dataset: 'spans',
      unit: null,
      formula: '',
      params: [],
      references: [],
    };
  }

  return {
    id: formula.id,
    name: formula.name.startsWith(NAME_PREFIX)
      ? formula.name.slice(NAME_PREFIX.length)
      : formula.name,
    dataset: formula.dataset,
    unit: formula.unit,
    formula: formula.formula,
    params: formula.params.map(param => ({
      key: uniqueId(),
      name: param.name,
      type: param.type,
      value: stripVariableBraces(param.value),
    })),
    references: formula.references,
  };
}

export function toRequest(draft: FormulaDraft): SavedFormulaRequest & {id?: string} {
  const paramNames = draft.params.map(param => param.name);

  return {
    ...draft,
    name: `${NAME_PREFIX}${draft.name}`,
    params: draft.params.map((param, order) => ({
      name: param.name,
      type: param.type,
      order,
      // Only calculations have a value, the rest are filled in at call time.
      value:
        param.type === 'calculation' ? addVariableBraces(param.value, paramNames) : '',
    })),
  };
}
