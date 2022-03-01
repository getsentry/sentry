import {useState} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';

import {revertToPinnedFilters} from 'sentry/actionCreators/pageFilters';
import Alert from 'sentry/components/alert';
import {IconClose, IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import space from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  router: InjectedRouter;
};

export default function DesyncedFilterAlert({router}: Props) {
  const {desyncedFilters} = useLegacyStore(PageFiltersStore);
  const organization = useOrganization();
  const [hideAlert, setHideAlert] = useState<boolean>(false);

  const onRevertClick = () => {
    revertToPinnedFilters(organization.slug, router);
  };

  return desyncedFilters.size > 0 && !hideAlert ? (
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
          <IconClose color="purple300" onClick={() => setHideAlert(true)} />
        </AlertActions>
      </AlertWrapper>
    </Alert>
  ) : null;
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
