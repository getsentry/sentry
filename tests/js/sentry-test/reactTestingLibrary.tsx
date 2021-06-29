import {Component, Fragment} from 'react';
import {cache} from '@emotion/css';
import {CacheProvider, ThemeProvider} from '@emotion/react';
import {render, RenderOptions} from '@testing-library/react';

import {lightTheme} from 'app/utils/theme';

type ContextRenderOptions = RenderOptions & {context?: Record<string, any>};

function createProvider(contextDefs: Record<string, any>) {
  return class ContextProvider extends Component {
    static childContextTypes = contextDefs.childContextTypes;

    getChildContext() {
      return contextDefs.context;
    }

    render() {
      return this.props.children;
    }
  };
}

function makeAllTheProviders(context?: Record<string, any>) {
  return function ({children}: {children?: React.ReactNode}) {
    const ContextProvider = context ? createProvider(context) : Fragment;
    return (
      <ContextProvider>
        <CacheProvider value={cache}>
          <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>
        </CacheProvider>
      </ContextProvider>
    );
  };
}

/**
 * Migrating from enzyme? Pass context via the options object
 * Before
 * mountWithTheme(<Something />, routerContext);
 * After
 * mountWithTheme(<Something />, {context: routerContext});
 */
const mountWithTheme = (ui: React.ReactElement, options?: ContextRenderOptions) => {
  const {context, ...otherOptions} = options ?? {};

  const AllTheProviders = makeAllTheProviders(context);

  return render(ui, {wrapper: AllTheProviders, ...otherOptions});
};

export * from '@testing-library/react';
export {mountWithTheme};
