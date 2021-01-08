import React from 'react';

import {t} from 'app/locale';
import {CandidateFeatures} from 'app/types/debugImage';

type Props = {
  type: keyof CandidateFeatures;
};

function Feature({type}: Props) {
  switch (type) {
    case 'has_debug_info':
      return <div>{t('debug')}</div>;
    case 'has_sources':
      return <div>{t('sources')}</div>;
    case 'has_symbols':
      return <div>{t('symtab')}</div>;
    case 'has_unwind_info':
      return <div>{t('unwind')}</div>;
    default:
      return null; // this shall not happen
  }
}

export default Feature;
