import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';

import {revertToPinnedFilters} from 'sentry/actionCreators/pageFilters';
import Alert from 'sentry/components/alert';
import {IconClose, IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';

type Props = {
  onClose: () => void;
  organization: Organization;
  router: InjectedRouter;
};

export default function DesyncedFilterAlert({router, organization, onClose}: Props) {
  const onRevertClick = () => {
    revertToPinnedFilters(organization.slug, router);
  };

  return (
    <Alert type="info" icon={<IconInfo size="md" />} system>
      <AlertWrapper>
        <AlertText>
          {t(
            "You're viewing a shared link. Certain queries and filters have been automatically filled from URL parameters."
          )}
        </AlertText>
        <AlertActions>
          <RevertText onClick={onRevertClick}>{t('Revert')}</RevertText>
          <Divider>|</Divider>
          <IconClose color="purple300" onClick={onClose} />
        </AlertActions>
      </AlertWrapper>
    </Alert>
  );
}

const AlertWrapper = styled('div')`
  display: flex;
`;

const AlertText = styled('div')`
  flex: 1;
  line-height: 22px;
`;

const AlertActions = styled('div')`
  display: grid;
  gap: ${space(1.5)};
  grid-auto-flow: column;
  align-items: center;
  cursor: pointer;
`;

const RevertText = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.purple300};
`;

const Divider = styled('div')`
  color: ${p => p.theme.purple200};
`;
