import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Clipboard from 'app/components/clipboard';
import ConfirmDelete from 'app/components/confirmDelete';
import DateTime from 'app/components/dateTime';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconCopy, IconDelete, IconEdit} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Relay} from 'app/types';

type Props = Relay & {
  onEdit: (publicKey: Relay['publicKey']) => () => void;
  onDelete: (publicKey: Relay['publicKey']) => () => void;
  disabled: boolean;
};

const CardHeader = ({
  publicKey,
  name,
  description,
  created,
  disabled,
  onEdit,
  onDelete,
}: Props) => {
  const deleteButton = (
    <Button
      size="small"
      icon={<IconDelete />}
      label={t('Delete Key')}
      disabled={disabled}
      title={disabled ? t('You do not have permission to delete keys') : undefined}
    />
  );
  return (
    <Header>
      <MainInfo>
        <Name>
          <div>{name}</div>
          {description && (
            <QuestionTooltip position="top" size="sm" title={description} />
          )}
        </Name>
        <Date>
          {tct('Created on [date]', {date: <DateTime date={created} timeAndDate />})}
        </Date>
      </MainInfo>
      <ButtonBar gap={1}>
        <Clipboard value={publicKey}>
          <Button size="small" icon={<IconCopy />}>
            {t('Copy Key')}
          </Button>
        </Clipboard>
        <Button
          size="small"
          onClick={onEdit(publicKey)}
          icon={<IconEdit />}
          label={t('Edit Key')}
          disabled={disabled}
          title={disabled ? t('You do not have permission to edit keys') : undefined}
        />
        {disabled ? (
          deleteButton
        ) : (
          <ConfirmDelete
            message={t(
              'After removing this Public Key, your Relay will no longer be able to communicate with Sentry and events will be dropped.'
            )}
            onConfirm={onDelete(publicKey)}
            confirmInput={name}
          >
            {deleteButton}
          </ConfirmDelete>
        )}
      </ButtonBar>
    </Header>
  );
};

export default CardHeader;

const Name = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(0.5)};
`;

const MainInfo = styled('div')`
  color: ${p => p.theme.textColor};
  display: grid;
  grid-gap: ${space(1)};
`;

const Date = styled('small')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Header = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  align-items: flex-start;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr max-content;
  }
`;
