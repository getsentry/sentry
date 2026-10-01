import {useContext} from 'react';

import {TranslationContext} from './translationContext';

export function useTranslation() {
  return useContext(TranslationContext);
}
