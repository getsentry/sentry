import {TranslationContext} from './translationContext';

/** @public */
export type {TranslationContextValue} from './translationContext';

export const TranslationContextProvider = TranslationContext.Provider;

export {useTranslation} from './useTranslation';

export {configureTranslation, pgettext, t, tn, type Translation} from './translate';
