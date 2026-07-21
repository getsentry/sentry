import {createContext, useContext} from 'react';

type FormattedQueryConfig = {
  wrapTokens: boolean;
};

export const FormattedQueryConfigContext = createContext<FormattedQueryConfig>({
  wrapTokens: false,
});

export function useFormattedQueryConfig() {
  return useContext(FormattedQueryConfigContext);
}
