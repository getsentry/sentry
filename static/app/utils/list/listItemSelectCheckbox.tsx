import styled from '@emotion/styled';

import {Checkbox} from '@sentry/scraps/checkbox';

import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';

const CheckboxClickTarget = styled('label')`
  cursor: pointer;
  display: block;
  margin: -${p => p.theme.space.md};
  padding: ${p => p.theme.space.md};
  max-width: unset;
  line-height: 0;
`;

export function ListItemSelectCheckbox({
  htmlPrefix,
  value,
}: {
  htmlPrefix: string;
  value: string;
}) {
  const {isSelected, toggleSelected} = useListItemCheckboxContext();
  const htmlId = `${htmlPrefix}-${value}`;
  return (
    <CheckboxClickTarget htmlFor={htmlId}>
      <Checkbox
        id={htmlId}
        disabled={isSelected(value) === 'all-selected'}
        checked={isSelected(value) !== false}
        onChange={() => toggleSelected(value)}
      />
    </CheckboxClickTarget>
  );
}
