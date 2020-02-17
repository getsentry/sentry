import React from 'react';

import {Release} from 'app/types';
import {PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';

type Props = {
  release: Release;
};

const ReleaseHealth = ({release}: Props) => {
  return (
    <React.Fragment>
      <PanelHeader>
        <div>{t('Project')}</div>
        <div>{t('Crash free users')}</div>
        <div>{t('Crash free sessions')}</div>
        <div>{t('Daily active users')}</div>
        <div>{t('Total crashes')}</div>
        <div>{t('Total errors')}</div>
      </PanelHeader>

      <PanelBody>
        <p>
          Lorem ipsum dolor sit, amet consectetur adipisicing elit. Corporis blanditiis
          eos ab, quos nostrum non numquam minima culpa soluta corrupti quia a pariatur
          officia harum, magni ut. Ullam, quis dolor?
        </p>
      </PanelBody>
    </React.Fragment>
  );
};

export default ReleaseHealth;
