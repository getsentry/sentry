import {createContext, useContext, type ReactNode} from 'react';

import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {t} from 'sentry/locale';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';

export const ISSUE_DISPLAY_PROPERTIES: Array<{label: string; value: GroupListColumn}> = [
  {value: 'lastSeen', label: t('Last seen')},
  {value: 'firstSeen', label: t('Age')},
  {value: 'graph', label: t('Trend')},
  {value: 'event', label: t('Events')},
  {value: 'users', label: t('Users')},
  {value: 'priority', label: t('Priority')},
  {value: 'assignee', label: t('Assignee')},
];

export const DEFAULT_ISSUE_COLUMNS: GroupListColumn[] = [
  'graph',
  'firstSeen',
  'lastSeen',
  'event',
  'users',
  'priority',
  'assignee',
  'lastTriggered',
];

type IssueDisplayProperties = {
  columns: GroupListColumn[];
  resetColumns: () => void;
  toggleColumn: (column: GroupListColumn) => void;
};

const IssueDisplayPropertiesContext = createContext<IssueDisplayProperties | null>(null);

export function IssueDisplayPropertiesProvider({children}: {children: ReactNode}) {
  const organization = useOrganization();
  const [columns, setColumns] = useLocalStorageState<GroupListColumn[]>(
    `issues-display-columns:${organization.slug}`,
    stored => {
      if (!Array.isArray(stored)) {
        return DEFAULT_ISSUE_COLUMNS;
      }
      // Keep the canonical order and ignore stale or invalid properties.
      return DEFAULT_ISSUE_COLUMNS.filter(column => stored.includes(column));
    }
  );

  return (
    <IssueDisplayPropertiesContext
      value={{
        columns,
        toggleColumn: column =>
          setColumns(current =>
            current.includes(column)
              ? current.filter(value => value !== column)
              : DEFAULT_ISSUE_COLUMNS.filter(
                  value => value === column || current.includes(value)
                )
          ),
        resetColumns: () => setColumns(DEFAULT_ISSUE_COLUMNS),
      }}
    >
      {children}
    </IssueDisplayPropertiesContext>
  );
}

export function useIssueDisplayProperties() {
  const context = useContext(IssueDisplayPropertiesContext);
  if (!context) {
    throw new Error('useIssueDisplayProperties requires IssueDisplayPropertiesProvider');
  }
  return context;
}
