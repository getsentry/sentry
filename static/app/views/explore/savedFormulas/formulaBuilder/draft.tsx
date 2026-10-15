import type {SavedFormula} from 'sentry/views/explore/hooks/useGetSavedFormulas';
import type {SavedFormulaRequest} from 'sentry/views/explore/hooks/useSaveFormula';

/** Names are stored with this prefix so they can't collide with a built in function. */
export const NAME_PREFIX = 'formula.';

/**
 * What the builder edits. Names are held without their prefix.
 */
export type FormulaDraft = Omit<SavedFormulaRequest, 'name'> & {
  name: string;
  id?: string;
};

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
    params: formula.params,
    references: formula.references,
  };
}

export function toRequest(draft: FormulaDraft): SavedFormulaRequest & {id?: string} {
  return {...draft, name: `${NAME_PREFIX}${draft.name}`};
}
