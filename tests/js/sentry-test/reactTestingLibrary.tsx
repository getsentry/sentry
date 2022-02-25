import {Component, Fragment} from 'react';
import {cache} from '@emotion/css';
import {CacheProvider, ThemeProvider} from '@emotion/react';
// eslint-disable-next-line no-restricted-imports
import {
  fireEvent as reactRtlFireEvent,
  render,
  RenderOptions,
} from '@testing-library/react';
import * as reactHooks from '@testing-library/react-hooks'; // eslint-disable-line no-restricted-imports
import userEvent from '@testing-library/user-event'; // eslint-disable-line no-restricted-imports

import GlobalModal from 'sentry/components/globalModal';
import {lightTheme} from 'sentry/utils/theme';

type Options = Record<string, any> & RenderOptions;

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

function makeBaseProviders(context?: Record<string, any>) {
  const ContextProvider = context ? createProvider(context) : Fragment;
  return function ({children}: {children?: React.ReactNode}) {
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
function mountWithTheme(component: React.ReactElement, options: Options = {}) {
  const {context, ...testingLibraryOptions} = options;

  const BaseProviders = makeBaseProviders(context);

  return render(<BaseProviders>{component}</BaseProviders>, {
    ...testingLibraryOptions,
  });
}

/**
 * @deprecated
 * Use userEvent over fireEvent where possible.
 * More details: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library#not-using-testing-libraryuser-event
 */
const fireEvent = reactRtlFireEvent;

function mountGlobalModal(options?: Options) {
  return mountWithTheme(<GlobalModal />, options);
}

export * from '@testing-library/react'; // eslint-disable-line no-restricted-imports
export {mountWithTheme, mountGlobalModal, userEvent, reactHooks, fireEvent};
