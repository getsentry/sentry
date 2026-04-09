import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Checkbox} from '@sentry/scraps/checkbox';

import {t} from 'sentry/locale';
import {useOptionalIssueSelectionActions} from 'sentry/views/issueList/issueSelectionContext';

interface SupergroupCheckboxProps {
  matchedGroupIds: string[];
  selectedCount: number;
}

export function SupergroupCheckbox({
  matchedGroupIds,
  selectedCount,
}: SupergroupCheckboxProps) {
  const actions = useOptionalIssueSelectionActions();

  const checkedState =
    selectedCount === 0
      ? false
      : selectedCount === matchedGroupIds.length
        ? true
        : ('indeterminate' as const);

  const handleChange = useCallback(
    (evt: React.MouseEvent) => {
      evt.stopPropagation();
      const nextValue = checkedState !== true;
      actions?.setSelectionForIds(matchedGroupIds, nextValue);
    },
    [actions, matchedGroupIds, checkedState]
  );

  if (!actions) {
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
