import {createContext, useContext, useState} from 'react';

import Alert from 'sentry/components/alert';
import {IconFlag} from 'sentry/icons';

const pageErrorContext = createContext<{
  pageError?: string;
  setPageError: (error: string | undefined) => void;
}>({
  pageError: undefined,
  setPageError: (_: string | undefined) => {},
});

export const PageErrorProvider = ({children}: {children: React.ReactNode}) => {
  const [pageError, setPageError] = useState<string | undefined>();
  return (
    <pageErrorContext.Provider
      value={{
        pageError,
        setPageError,
      }}
    >
      {children}
    </pageErrorContext.Provider>
  );
};

export const PageErrorAlert = () => {
  const {pageError} = useContext(pageErrorContext);
  if (!pageError) {
    return null;
  }

  return (
    <Alert type="error" icon={<IconFlag size="md" />}>
      {pageError}
    </Alert>
  );
};

export const usePageError = () => useContext(pageErrorContext);
