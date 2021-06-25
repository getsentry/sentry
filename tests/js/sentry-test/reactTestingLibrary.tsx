import React from 'react';
import {cache} from '@emotion/css';
import {CacheProvider, ThemeProvider} from '@emotion/react';
import {render, RenderOptions} from '@testing-library/react';

import {lightTheme} from 'app/utils/theme';

type ContextRenderOptions = RenderOptions & {context: any};

const makeAllTheProviders =
  (context: any) =>
  ({children}: {children?: React.ReactNode}) => {
    const ContextProvider = context ? createProvider(context) : React.Fragment;
    return (
      <ContextProvider>
        <CacheProvider value={cache}>
          <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>
        </CacheProvider>
      </ContextProvider>
    );
  };

const mountWithTheme = (ui: React.ReactElement, options?: ContextRenderOptions) => {
  const {context, ...otherOptions} = options ?? {};

  const AllTheProviders = makeAllTheProviders(context);

  return render(ui, {wrapper: AllTheProviders, ...otherOptions});
};

export * from '@testing-library/react';
export {mountWithTheme};

function createProvider(contextDefs) {
  return class ContextProvider extends React.Component {
    static childContextTypes = contextDefs.childContextTypes;

    getChildContext() {
      return contextDefs.context;
    }
    render() {
      return this.props.children;
    }
  };
}
