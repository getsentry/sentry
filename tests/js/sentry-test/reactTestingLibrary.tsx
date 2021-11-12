import {Component, Fragment} from 'react';
import {cache} from '@emotion/css';
import {CacheProvider, ThemeProvider} from '@emotion/react';
import {
  fireEvent as reactRtlFireEvent,
  render,
  RenderOptions,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {Organization} from 'app/types';
import {lightTheme} from 'app/utils/theme';
import {OrganizationContext} from 'app/views/organizationContext';

type ProviderOptions = {
  context?: Record<string, any>;
  organization?: Organization;
};

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

function makeAllTheProviders({context, organization}: ProviderOptions) {
  return function ({children}: {children?: React.ReactNode}) {
    const ContextProvider = context ? createProvider(context) : Fragment;

    return (
      <ContextProvider>
        <CacheProvider value={cache}>
          <ThemeProvider theme={lightTheme}>
            {organization ? (
              <OrganizationContext.Provider value={organization}>
                {children}
              </OrganizationContext.Provider>
            ) : (
              children
            )}
          </ThemeProvider>
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
const mountWithTheme = (
  ui: React.ReactElement,
  options?: ProviderOptions & RenderOptions
) => {
  const {context, organization, ...otherOptions} = options ?? {};

  const AllTheProviders = makeAllTheProviders({context, organization});

  return render(ui, {wrapper: AllTheProviders, ...otherOptions});
};

export * from '@testing-library/react';

/**
 * @deprecated
 * Use userEvent over fireEvent where possible.
 * More details: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library#not-using-testing-libraryuser-event
 */
const fireEvent = reactRtlFireEvent;

export {mountWithTheme, userEvent, fireEvent};
