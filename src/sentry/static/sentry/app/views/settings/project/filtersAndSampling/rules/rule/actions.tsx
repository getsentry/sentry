import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {IconDelete, IconEdit} from 'app/icons';
import {t} from 'app/locale';

type Props = {
  disabled: boolean;
  onEditRule: () => void;
  onDeleteRule: () => void;
};

function Actions({disabled, onEditRule, onDeleteRule}: Props) {
  return (
    <StyledButtonbar gap={1}>
      <Button
        label={t('Edit Rule')}
        size="small"
        onClick={onEditRule}
        icon={<IconEdit />}
        disabled={disabled}
      />
      <Button
        label={t('Delete Rule')}
        size="small"
        onClick={onDeleteRule}
        icon={<IconDelete />}
        disabled={disabled}
      />
    </StyledButtonbar>
  );
}

export default Actions;

const StyledButtonbar = styled(ButtonBar)`
  justify-content: flex-end;
  flex: 1;
`;
