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

/**
 * Fills each argument with the param's suggested value, falling back to a
 * generic default. Returns null when a column has neither.
 */
export function buildFormulaYAxis(
  formula: SavedFormula,
  defaultColumn: string | null
): string | null {
  const args: string[] = [];
  for (const param of getFormulaArgumentParams(formula)) {
    const arg =
      param.value || (param.type === 'number' ? DEFAULT_NUMBER_ARGUMENT : defaultColumn);
    if (!arg) {
      return null;
    }
    args.push(arg);
  }
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
