import {Component, Fragment} from 'react';
import {cache} from '@emotion/css';
import {CacheProvider, ThemeProvider} from '@emotion/react';
import * as rtl from '@testing-library/react'; // eslint-disable-line no-restricted-imports
import * as reactHooks from '@testing-library/react-hooks'; // eslint-disable-line no-restricted-imports
import userEvent from '@testing-library/user-event'; // eslint-disable-line no-restricted-imports

import GlobalModal from 'sentry/components/globalModal';
import {Organization} from 'sentry/types';
import {lightTheme} from 'sentry/utils/theme';
import {OrganizationContext} from 'sentry/views/organizationContext';

type ProviderOptions = {
  context?: Record<string, any>;
  organization?: Organization;
};

type Options = ProviderOptions & rtl.RenderOptions;

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
  const ContextProvider = context ? createProvider(context) : Fragment;
  return function ({children}: {children?: React.ReactNode}) {
    return (
      <ContextProvider>
        <CacheProvider value={cache}>
          <ThemeProvider theme={lightTheme}>
            <OrganizationContext.Provider value={organization ?? null}>
              {children}
            </OrganizationContext.Provider>
          </ThemeProvider>
        </CacheProvider>
      </ContextProvider>
    );
  };
}

/**
 * Migrating from enzyme?
 * Try avoiding unnecessary context and just mount your component. If it works, then you dont need anything else.
 * render(<TestedComponent />);
 *
 * If your component requires routerContext or organization to render, pass it via context options argument.
 * render(<TestedComponent />, {context: routerContext, organization});
 */
function render(ui: React.ReactElement, options?: Options) {
  const {context, organization, ...otherOptions} = options ?? {};

  const AllTheProviders = makeAllTheProviders({context, organization});

  return rtl.render(ui, {wrapper: AllTheProviders, ...otherOptions});
}

/**
 * @deprecated
 * Use userEvent over fireEvent where possible.
 * More details: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library#not-using-testing-libraryuser-event
 */
const fireEvent = rtl.fireEvent;

function renderGlobalModal(options?: Options) {
  return render(<GlobalModal />, options);
}

// eslint-disable-next-line no-restricted-imports, import/export
export * from '@testing-library/react';

// eslint-disable-next-line import/export
export {render, renderGlobalModal, userEvent, reactHooks, fireEvent};
