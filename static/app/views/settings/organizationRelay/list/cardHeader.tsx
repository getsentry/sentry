import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ConfirmDelete from 'sentry/components/confirmDelete';
import DateTime from 'sentry/components/dateTime';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconCopy, IconDelete, IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Relay} from 'sentry/types';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

type Props = Relay & {
  disabled: boolean;
  onDelete: (publicKey: Relay['publicKey']) => () => void;
  onEdit: (publicKey: Relay['publicKey']) => () => void;
};

function CardHeader({
  publicKey,
  name,
  description,
  created,
  disabled,
  onEdit,
  onDelete,
}: Props) {
  const {onClick} = useCopyToClipboard({text: publicKey});

  const deleteButton = (
    <Button
      size="sm"
      icon={<IconDelete />}
      aria-label={t('Delete Key')}
      disabled={disabled}
      title={disabled ? t('You do not have permission to delete keys') : undefined}
    />
  );
  return (
    <Header>
      <KeyName>
        {name}
        {description && <QuestionTooltip position="top" size="sm" title={description} />}
      </KeyName>
      <DateCreated>
        {tct('Created on [date]', {date: <DateTime date={created} />})}
      </DateCreated>
      <StyledButtonBar gap={1}>
        <Button size="sm" icon={<IconCopy />} onClick={onClick}>
          {t('Copy Key')}
        </Button>
        <Button
          size="sm"
          onClick={onEdit(publicKey)}
          icon={<IconEdit />}
          aria-label={t('Edit Key')}
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
      </StyledButtonBar>
    </Header>
  );
}

export default CardHeader;

const KeyName = styled('div')`
  grid-row: 1/2;
  grid-template-columns: repeat(2, max-content);
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const DateCreated = styled('div')`
  grid-row: 2/3;
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledButtonBar = styled(ButtonBar)`
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-row: 1/3;
  }
`;

const Header = styled('div')`
  display: grid;
  grid-row-gap: ${space(0.25)};
  margin-bottom: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 1fr max-content;
    grid-template-rows: repeat(2, max-content);
  }
`;
