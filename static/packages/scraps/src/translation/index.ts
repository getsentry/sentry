import {TranslationContext} from './translationContext';

/** @public */
export type {TranslationContextValue} from './translationContext';

export const TranslationContextProvider = TranslationContext.Provider;

export {useTranslation} from './useTranslation';

export {pgettext, t, tn, type Translation} from './translate';
