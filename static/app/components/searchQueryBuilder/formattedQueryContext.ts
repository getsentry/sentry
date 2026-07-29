import {createContext, useContext} from 'react';

type FormattedQueryConfig = {
  wrapTokens: boolean;
};

export const FormattedQueryConfigContext = createContext<FormattedQueryConfig>({
  wrapTokens: false,
});

export function useFormattedQueryConfig() {
  const context = useContext(FormattedQueryConfigContext);

  if (!context) {
    throw new Error(
      'useFormattedQueryConfig must be used within a FormattedQueryConfigProvider'
    );
  }

  return context;
}
