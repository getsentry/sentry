import React from 'react';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t} from 'sentry/locale';

import {TabBarId} from '../types';

type Props = {
  active: TabBarId;
  setActive: (id: TabBarId) => void;
};

function FocusButtons({active, setActive}: Props) {
  const select = (barId: TabBarId) => () => {
    setActive(barId);
  };

  return (
    <ButtonBar active={active} merged>
      <Button barId="console" onClick={select('console')}>
        {t('Console')}
      </Button>
      <Button barId="performance" onClick={select('performance')}>
        {t('Performance')}
      </Button>
      <Button barId="errors" onClick={select('errors')}>
        {t('Errors')}
      </Button>
      <Button barId="tags" onClick={select('tags')}>
        {t('Tags')}
      </Button>
    </ButtonBar>
  );
}

export default FocusButtons;
