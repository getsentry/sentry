import {Fragment, useState} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';

import {revertToPinnedFilters} from 'sentry/actionCreators/pageFilters';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type Props = {
  router: InjectedRouter;
};

export default function DesyncedFilterAlert({router}: Props) {
  const {desyncedFilters} = usePageFilters();
  const organization = useOrganization();
  const [hideAlert, setHideAlert] = useState(false);

  const onRevertClick = () => {
    revertToPinnedFilters(organization.slug, router);
  };

  if (desyncedFilters.size === 0 || hideAlert) {
    return null;
  }

  return (
    <Alert
      type="info"
      showIcon
      system
      trailingItems={
        <Fragment>
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
        </Fragment>
      }
    >
      {t(
        "You're viewing a shared link. Certain queries and filters have been automatically filled from URL parameters."
      )}
    </Alert>
  );
}

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
