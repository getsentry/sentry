import {useCallback, useMemo, useState} from 'react';

/**
 * Tracks which metric labels (A, B, etc.) are referenced by equations.
 * Each EquationBuilder reports its labels via onEquationLabelsChange after
 * unresolving its expression. The aggregate set is derived from state.
 */
export function useEquationReferencedLabels() {
  const [equationLabels, onEquationLabelsChangeState] = useState(
    new Map<string, string[]>()
  );

  const onEquationLabelsChange = useCallback(
    (equationLabel: string, labels: string[]) => {
      onEquationLabelsChangeState(prev => new Map(prev).set(equationLabel, labels));
    },
    []
  );

  const referencedMetricLabels = useMemo(() => {
    const set = new Set<string>();
    for (const labels of equationLabels.values()) {
      for (const label of labels) {
        set.add(label);
      }
    }
    return set;
  }, [equationLabels]);

  return {referencedMetricLabels, onEquationLabelsChange};
}
