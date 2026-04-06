import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {Checkbox} from '@sentry/scraps/checkbox';

import {t} from 'sentry/locale';
import {
  useOptionalIssueSelectionActions,
  useOptionalIssueSelectionSummary,
} from 'sentry/views/issueList/issueSelectionContext';

interface SupergroupCheckboxProps {
  matchedGroupIds: string[];
}

export function SupergroupCheckbox({matchedGroupIds}: SupergroupCheckboxProps) {
  const summary = useOptionalIssueSelectionSummary();
  const actions = useOptionalIssueSelectionActions();

  const checkedState = useMemo(() => {
    if (!summary || matchedGroupIds.length === 0) {
      return false;
    }
    let selectedCount = 0;
    for (const id of matchedGroupIds) {
      if (summary.records.get(id)) {
        selectedCount++;
      }
    }
    if (selectedCount === 0) {
      return false;
    }
    if (selectedCount === matchedGroupIds.length) {
      return true;
    }
    return 'indeterminate' as const;
  }, [summary, matchedGroupIds]);

  const handleChange = useCallback(
    (evt: React.MouseEvent) => {
      evt.stopPropagation();
      const nextValue = checkedState !== true;
      actions?.setSelectionForIds(matchedGroupIds, nextValue);
    },
    [actions, matchedGroupIds, checkedState]
  );

  if (!summary || !actions) {
    return null;
  }

  return (
    <CheckboxLabel>
      <CheckboxWithBackground
        aria-label={t('Select supergroup issues')}
        checked={checkedState}
        onChange={() => {}}
        onClick={handleChange}
      />
    </CheckboxLabel>
  );
}

export const CheckboxLabel = styled('label')`
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CheckboxWithBackground = styled(Checkbox)`
  background-color: ${p => p.theme.tokens.background.primary};
`;
