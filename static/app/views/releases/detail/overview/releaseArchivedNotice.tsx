import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';

type Props = {
  multi?: boolean;
  onRestore?: () => void;
};

function ReleaseArchivedNotice({onRestore, multi}: Props) {
  return (
    <Alert.Container>
      <Alert type="warning">
        {multi
          ? t('These releases have been archived.')
          : t('This release has been archived.')}

        {!multi && onRestore && (
          <Fragment>
            {' '}
            <UnarchiveButton size="zero" priority="link" onClick={onRestore}>
              {t('Restore this release')}
            </UnarchiveButton>
          </Fragment>
        )}
      </Alert>
    </Alert.Container>
  );
}

const UnarchiveButton = styled(Button)`
  font-size: inherit;
  text-decoration: underline;
  &,
  &:hover,
  &:focus,
  &:active {
    color: ${p => p.theme.textColor};
  }
`;

export default ReleaseArchivedNotice;
