import {createContext, useContext, useState} from 'react';
import {Theme} from '@emotion/react';

import {Alert} from 'sentry/components/alert';

export type PageAlert = {
  message: string;
  type: keyof Theme['alert'];
};

const pageErrorContext = createContext<{
  setPageError: (error: PageAlert | string | undefined) => void;
  pageError?: PageAlert | string;
}>({
  pageError: undefined,
  setPageError: (_: PageAlert | string | undefined) => {},
});

export function PageErrorProvider({children}: {children: React.ReactNode}) {
  const [pageError, setPageError] = useState<PageAlert | string | undefined>();
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
}

export function PageErrorAlert() {
  const {pageError} = useContext(pageErrorContext);
  if (!pageError) {
    return null;
  }

  const type = typeof pageError === 'string' ? 'error' : pageError.type;
  const message = typeof pageError === 'string' ? pageError : pageError.message;

  return (
    <Alert type={type} data-test-id="page-error-alert" showIcon>
      {message}
    </Alert>
  );
}

export const usePageError = () => useContext(pageErrorContext);
