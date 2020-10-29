import React from 'react';
import styled from '@emotion/styled';

import {t, tct} from 'app/locale';
import Button from 'app/components/button';
import ConfirmDelete from 'app/components/confirmDelete';
import ButtonBar from 'app/components/buttonBar';
import QuestionTooltip from 'app/components/questionTooltip';
import DateTime from 'app/components/dateTime';
import {IconEdit, IconDelete, IconCopy} from 'app/icons';
import space from 'app/styles/space';
import {Relay} from 'app/types';
import Clipboard from 'app/components/clipboard';

type Props = Relay & {
  onEdit: (publicKey: Relay['publicKey']) => () => void;
  onDelete: (publicKey: Relay['publicKey']) => () => void;
};

const CardHeader = ({publicKey, name, description, created, onEdit, onDelete}: Props) => (
  <Header>
    <MainInfo>
      <Name>
        <div>{name}</div>
        {description && <QuestionTooltip position="top" size="sm" title={description} />}
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
      />
      <ConfirmDelete
        message={t(
          'After removing this Public Key, your Relay will no longer be able to communicate with Sentry and events will be dropped.'
        )}
        onConfirm={onDelete(publicKey)}
        confirmInput={name}
      >
        <Button size="small" icon={<IconDelete />} label={t('Delete Key')} />
      </ConfirmDelete>
    </ButtonBar>
  </Header>
);

export default CardHeader;

const Header = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  align-items: flex-start;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr max-content;
  }
`;

const Name = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(0.5)};
`;

const MainInfo = styled('div')`
  color: ${p => p.theme.gray700};
  display: grid;
  grid-gap: ${space(1)};
`;

const Date = styled('small')`
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeMedium};
`;
