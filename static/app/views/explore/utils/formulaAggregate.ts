import type {ParsedFunction} from 'sentry/utils/discover/fields';
import type {
  FormulaParam,
  SavedFormula,
} from 'sentry/views/explore/hooks/useGetSavedFormulas';

const DEFAULT_NUMBER_ARGUMENT = '1';

export function findFormula(
  formulas: readonly SavedFormula[],
  name: string | undefined
): SavedFormula | undefined {
  return name ? formulas.find(formula => formula.name === name) : undefined;
}

export function getFormulaArgumentParams(formula: SavedFormula): FormulaParam[] {
  return formula.params
    .filter(param => param.type !== 'calculation')
    .toSorted((a, b) => a.order - b.order);
}

export function buildFormulaYAxis(
  formula: SavedFormula,
  defaultColumn: string | null
): string | null {
  const params = getFormulaArgumentParams(formula);
  if (!defaultColumn && params.some(param => param.type === 'column')) {
    return null;
  }
  const args = params.map(param =>
    param.type === 'number' ? DEFAULT_NUMBER_ARGUMENT : defaultColumn
  );
  return `${formula.name}(${args.join(',')})`;
}

export function getFormulaColumnFunction(
  formula: SavedFormula,
  parsedFunction: ParsedFunction
): ParsedFunction {
  return {
    ...parsedFunction,
    arguments: getFormulaArgumentParams(formula).flatMap((param, index) =>
      param.type === 'column' ? (parsedFunction.arguments[index] ?? []) : []
    ),
  };
}
