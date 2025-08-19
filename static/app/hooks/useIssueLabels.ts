import {useCallback, useMemo} from 'react';

import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

export interface IssueLabel {
  color: string;
  id: string;
  name: string;
}

export type IssueLabelsRecord = Record<string, IssueLabel[]>;

const STORAGE_KEY = 'sentry_issue_labels';

// Generate a deterministic color for a label based on its name
const generateLabelColor = (labelName: string): string => {
  const colors = [
    '#3F51B5',
    '#2196F3',
    '#00BCD4',
    '#009688',
    '#4CAF50',
    '#8BC34A',
    '#CDDC39',
    '#FFEB3B',
    '#FFC107',
    '#FF9800',
    '#FF5722',
    '#795548',
    '#9E9E9E',
    '#607D8B',
    '#E91E63',
  ];

  // Hash the label name to get a consistent index
  let hash = 0;
  for (let i = 0; i < labelName.length; i++) {
    const char = labelName.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return colors[Math.abs(hash) % colors.length];
};

export function useIssueLabels() {
  // Shared, reactive state across the app via localStorage sync
  const [storedLabels, setStoredLabels] = useSyncedLocalStorageState<IssueLabelsRecord>(
    STORAGE_KEY,
    {}
  );

  // Normalize colors deterministically on read so same name => same color everywhere
  const labels = useMemo<IssueLabelsRecord>(() => {
    const normalized: IssueLabelsRecord = {};
    Object.entries(storedLabels ?? {}).forEach(([issueId, issueLabels]) => {
      normalized[issueId] = (issueLabels ?? []).map(lbl => ({
        ...lbl,
        color: generateLabelColor(lbl.name.trim().toLowerCase()),
      }));
    });
    return normalized;
  }, [storedLabels]);

  // Get labels for a specific issue
  const getIssueLabels = useCallback(
    (issueId: string): IssueLabel[] => {
      return labels[issueId] || [];
    },
    [labels]
  );

  // Add a label to an issue
  const addLabel = useCallback(
    (issueId: string, labelName: string): boolean => {
      if (!issueId || typeof issueId !== 'string') return false;

      const trimmedName = labelName.trim();
      if (!trimmedName) return false;

      const existingLabels = labels[issueId] || [];

      // Check if label already exists
      if (
        existingLabels.some(
          label => label.name.toLowerCase() === trimmedName.toLowerCase()
        )
      ) {
        return false; // Label already exists
      }

      const newLabel: IssueLabel = {
        id: `${issueId}-${trimmedName}-${Date.now()}`,
        name: trimmedName,
        color: generateLabelColor(trimmedName.toLowerCase()),
      };

      const newLabels: IssueLabelsRecord = {
        ...storedLabels,
        [issueId]: [...(storedLabels[issueId] ?? []), newLabel],
      };

      setStoredLabels(newLabels);
      return true;
    },
    [labels, storedLabels, setStoredLabels]
  );

  // Remove a label from an issue
  const removeLabel = useCallback(
    (issueId: string, labelId: string): void => {
      if (!issueId || typeof issueId !== 'string') return;

      const current = storedLabels[issueId] ?? [];
      const newLabels: IssueLabelsRecord = {
        ...storedLabels,
        [issueId]: current.filter(label => label.id !== labelId),
      };

      setStoredLabels(newLabels);
    },
    [storedLabels, setStoredLabels]
  );

  // Get all unique label names across all issues
  const getAllLabelNames = useCallback((): string[] => {
    const allNames = new Set<string>();

    Object.values(labels).forEach(issueLabels => {
      issueLabels.forEach(label => {
        allNames.add(label.name);
      });
    });

    return Array.from(allNames).sort();
  }, [labels]);

  // Get all labels for all issues
  const allLabels = useMemo(() => labels, [labels]);

  return {
    allLabels,
    getIssueLabels,
    addLabel,
    removeLabel,
    getAllLabelNames,
  };
}
