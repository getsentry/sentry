import React from 'react';
import styled from '@emotion/styled';
import {t, tct} from 'app/locale';

import Button from 'app/components/button';
import space from 'app/styles/space';

type Props = {
  onSkip: (e: React.MouseEvent) => void;
  onDismiss: (e: React.MouseEvent) => void;
  orgId: string;
  hide: boolean;
  className?: string;
};

const Confirmation = styled(({className, onDismiss, orgId, onSkip}: Props) => (
  <div className={className} onClick={onDismiss}>
    <Header>{t('Want help?')}</Header>
    <div>
      {tct('[support:Go to support] · [skip:Skip]', {
        support: <Button priority="link" to={`/settings/${orgId}/support/`} />,
        skip: <Button priority="link" onClick={onSkip} />,
      })}
    </div>
  </div>
))`
  display: ${p => (p.hide ? 'none' : 'flex')};
  position: absolute;
  top: 0px;
  left: 0px;
  bottom: 0px;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  background: rgba(255, 255, 255, 0.65);
  width: 100%;
`;

const Header = styled('h4')`
  margin-bottom: ${space(1)};
`;

export default Confirmation;
