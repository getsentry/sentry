import {useState} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';

import {revertToPinnedFilters} from 'sentry/actionCreators/pageFilters';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
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
  const [hideAlert, setHideAlert] = useState(false);

  const onRevertClick = () => {
    revertToPinnedFilters(organization.slug, router);
  };

  if (desyncedFilters.size === 0 || hideAlert) {
    return null;
  }

  return (
    <Alert type="info" icon={<IconInfo size="md" />} system>
      <AlertWrapper>
        <AlertText>
          {t(
            "You're viewing a shared link. Certain queries and filters have been automatically filled from URL parameters."
          )}
        </AlertText>
        <ButtonBar gap={1.5}>
          <RevertButton priority="link" size="zero" onClick={onRevertClick} borderless>
            {t('Revert')}
          </RevertButton>
          <Button
            priority="link"
            size="zero"
            icon={<IconClose color="purple300" />}
            aria-label={t('Close Alert')}
            onClick={() => setHideAlert(true)}
          />
        </ButtonBar>
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

const RevertButton = styled(Button)`
  display: flex;
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.purple300};

  &:after {
    content: '|';
    margin-left: ${space(2)};
    color: ${p => p.theme.purple200};
  }
`;
