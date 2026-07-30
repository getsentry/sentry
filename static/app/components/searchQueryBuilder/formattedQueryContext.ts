import {createContext} from 'react';

type FormattedQueryConfig = {
  wrapTokens: boolean;
};

// FilterValueText is also used by the interactive query builder, where the
// absence of a provider means tokens should retain their default no-wrap behavior.
export const FormattedQueryConfigContext = createContext<FormattedQueryConfig>({
  wrapTokens: false,
});
