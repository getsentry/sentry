import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import type {LinkProps} from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface Props {
  goBackLocation: LinkProps['to'];
  invalidForm: boolean;
  onSave: (event: React.MouseEvent) => void;
  isEditing?: boolean;
  onDelete?: () => void;
}

export function Footer({
  goBackLocation,
  onSave,
  onDelete,
  invalidForm,
  isEditing,
}: Props) {
  return (
    <Wrapper>
      <Actions gap={1}>
        <Button to={goBackLocation}>{t('Cancel')}</Button>
        {isEditing && onDelete && (
          <Confirm
            priority="danger"
            message={t('Are you sure you want to delete this widget?')}
            onConfirm={onDelete}
          >
            <Button priority="danger">{t('Delete')}</Button>
          </Confirm>
        )}
        <Button
          priority="primary"
          onClick={onSave}
          disabled={invalidForm}
          title={
            invalidForm
              ? t('Required fields must be filled out and contain valid inputs')
              : undefined
          }
        >
          {isEditing ? t('Update Widget') : t('Add Widget')}
        </Button>
      </Actions>
    </Wrapper>
  );
}

const Actions = styled(ButtonBar)`
  justify-content: flex-end;
  max-width: 1000px;
  padding: ${space(4)} ${space(2)};

  /* to match Layout.Main padding + Field padding-right */
  padding-right: calc(${space(2)} + ${space(2)});

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(4)};

    /* to match Layout.Main padding + Field padding-right */
    padding-right: calc(${space(4)} + ${space(2)});
  }
`;

const Wrapper = styled('div')`
  background: ${p => p.theme.background};
  border-top: 1px solid ${p => p.theme.gray200};
`;
