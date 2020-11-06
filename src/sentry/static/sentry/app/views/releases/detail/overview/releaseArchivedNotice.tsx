import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {IconInfo} from 'app/icons';
import Alert from 'app/components/alert';
import Button from 'app/components/button';

type Props = {
  multi?: boolean;
  onRestore?: () => void;
};

function ReleaseArchivedNotice({onRestore, multi}: Props) {
  return (
    <Alert icon={<IconInfo size="md" />} type="warning">
      {multi
        ? t('These releases have been archived.')
        : t('This release has been archived.')}

      {!multi && onRestore && (
        <React.Fragment>
          {' '}
          <UnarchiveButton size="zero" priority="link" onClick={onRestore}>
            {t('Restore this release')}
          </UnarchiveButton>
        </React.Fragment>
      )}
    </Alert>
  );
}

const UnarchiveButton = styled(Button)`
  font-size: inherit; // to match font-size of alert
  text-decoration: underline;
  &,
  &:hover,
  &:focus,
  &:active {
    color: ${p => p.theme.textColor};
  }
`;

export default ReleaseArchivedNotice;
