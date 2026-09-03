import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';

import {ConfirmDelete} from 'sentry/components/confirmDelete';
import {DateTime} from 'sentry/components/dateTime';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {IconCopyId, IconDelete, IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Relay} from 'sentry/types/relay';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';

type Props = Relay & {
  disabled: boolean;
  onDelete: (publicKey: Relay['publicKey']) => () => void;
  onEdit: (publicKey: Relay['publicKey']) => () => void;
  extraAction?: React.ReactNode;
};

export function CardHeader({
  publicKey,
  name,
  description,
  created,
  disabled,
  extraAction,
  onEdit,
  onDelete,
}: Props) {
  const {copy} = useCopyToClipboard();

  const deleteButton = (
    <Button
      size="sm"
      icon={<IconDelete />}
      aria-label={t('Delete Key')}
      disabled={disabled}
      tooltipProps={{
        title: disabled ? t('You do not have permission to delete keys') : undefined,
      }}
    />
  );
  return (
    <Grid columns={{zero: '1fr', md: '1fr max-content'}} align="center" gap="md">
      <Stack gap="2xs">
        <Flex align="center" gap="md">
          {name}
          {description && (
            <QuestionTooltip position="top" size="sm" title={description} />
          )}
        </Flex>
        <DateCreated>
          {tct('Created on [date]', {date: <DateTime date={created} />})}
        </DateCreated>
      </Stack>
      <Flex align="center" gap="md" wrap="wrap" justify={{zero: 'start', md: 'end'}}>
        <Button
          size="sm"
          icon={<IconCopyId />}
          onClick={() => copy(publicKey, {successMessage: t('Copied key to clipboard')})}
        >
          {t('Copy Key')}
        </Button>
        <Button
          size="sm"
          onClick={onEdit(publicKey)}
          icon={<IconEdit />}
          aria-label={t('Edit Key')}
          disabled={disabled}
          tooltipProps={{
            title: disabled ? t('You do not have permission to edit keys') : undefined,
          }}
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
        {extraAction}
      </Flex>
    </Grid>
  );
}

const DateCreated = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
`;
