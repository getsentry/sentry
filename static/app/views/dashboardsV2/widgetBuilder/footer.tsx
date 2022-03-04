import * as React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type Props = {
  goBackLocation: React.ComponentProps<typeof Link>['to'];
  onSave: (event: React.MouseEvent) => void;
  isEditing?: boolean;
  onDelete?: () => void;
};

export function Footer({goBackLocation, onSave, onDelete, isEditing}: Props) {
  return (
    <FooterWrapper>
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
        <Button priority="primary" onClick={onSave}>
          {isEditing ? t('Update Widget') : t('Add Widget')}
        </Button>
      </Actions>
    </FooterWrapper>
  );
}

const Actions = styled(ButtonBar)`
  justify-content: flex-end;
`;

const FooterWrapper = styled('div')`
  background: ${p => p.theme.background};
  border-top: 1px solid ${p => p.theme.gray200};
  position: sticky;
  bottom: 0;
  padding: ${space(4)};
`;
