import {uniqueId} from 'sentry/utils/guid';
import type {
  FormulaParam,
  FormulaParamType,
  FormulaReference,
  SavedFormula,
} from 'sentry/views/explore/hooks/useGetSavedFormulas';
import type {SavedFormulaRequest} from 'sentry/views/explore/hooks/useSaveFormula';
import {
  addVariableBraces,
  stripVariableBraces,
} from 'sentry/views/explore/savedFormulas/formulaTokens';

/** Names are stored with this prefix so they can't collide with a built in function. */
const NAME_PREFIX = 'formula.';

/** The API resolves params positionally, and only has four positions. */
export const MAX_PARAMS = 4;

/** Rows are keyed separately because they have no name until one is typed in. */
export type DraftParam = Omit<FormulaParam, 'order'> & {key: string};
export type DraftReference = FormulaReference & {key: string};

/**
 * What the builder edits. Names are held without their prefix, and param order
 * comes from the order of the rows. Expressions hold names without the `{}` the
 * API wraps them in.
 */
export type FormulaDraft = Omit<SavedFormulaRequest, 'name' | 'params' | 'references'> & {
  name: string;
  params: DraftParam[];
  references: DraftReference[];
  id?: string;
};

export function newParam(type: FormulaParamType): DraftParam {
  return {key: uniqueId(), name: '', type, value: ''};
}

export function newReference(): DraftReference {
  return {key: uniqueId(), name: '', value: ''};
}

/** Every name the formula's own expression can refer to. */
export function variableNames(draft: FormulaDraft) {
  return [...draft.params, ...draft.references].map(({name}) => name);
}

export function stripNamePrefix(name: string) {
  return name.startsWith(NAME_PREFIX) ? name.slice(NAME_PREFIX.length) : name;
}

export function toDraft(formula: SavedFormula | undefined): FormulaDraft {
  if (!formula) {
    return {
      name: '',
      description: null,
      dataset: 'spans',
      unit: null,
      formula: '',
      params: [],
      references: [],
    };
  }

  return {
    id: formula.id,
    name: stripNamePrefix(formula.name),
    description: formula.description,
    dataset: formula.dataset,
    unit: formula.unit,
    formula: stripVariableBraces(formula.formula),
    params: formula.params.map(param => ({
      key: uniqueId(),
      name: param.name,
      type: param.type,
      value: stripVariableBraces(param.value),
    })),
    references: formula.references.map(reference => ({
      key: uniqueId(),
      name: reference.name,
      value: stripVariableBraces(reference.value),
    })),
  };
}

export function toRequest(draft: FormulaDraft): SavedFormulaRequest & {id?: string} {
  const paramNames = draft.params.map(param => param.name);

  return {
    ...draft,
    name: `${NAME_PREFIX}${draft.name}`,
    formula: addVariableBraces(draft.formula, variableNames(draft)),
    params: draft.params.map((param, order) => ({
      name: param.name,
      type: param.type,
      order,
      // Only calculations have a value, the rest are filled in at call time.
      value:
        param.type === 'calculation' ? addVariableBraces(param.value, paramNames) : '',
    })),
    references: draft.references.map(reference => ({
      name: reference.name,
      value: addVariableBraces(reference.value, paramNames),
    })),
  };
}
