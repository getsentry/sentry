import {createRoot} from 'react-dom/client';
import throttle from 'lodash/throttle';

import {exportedGlobals} from 'sentry/bootstrap/exportGlobals';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import type {OnSentryInitConfiguration} from 'sentry/types/system';
import {SentryInitRenderReactComponent} from 'sentry/types/system';

import {renderDom} from './renderDom';
import {renderOnDomReady} from './renderOnDomReady';

const COMPONENT_MAP = {
  [SentryInitRenderReactComponent.INDICATORS]: () =>
    import(/* webpackChunkName: "Indicators" */ 'sentry/components/indicators'),
  [SentryInitRenderReactComponent.SYSTEM_ALERTS]: () =>
    import(/* webpackChunkName: "SystemAlerts" */ 'sentry/views/app/systemAlerts'),
  [SentryInitRenderReactComponent.SETUP_WIZARD]: () =>
    import(/* webpackChunkName: "SetupWizard" */ 'sentry/views/setupWizard'),
  [SentryInitRenderReactComponent.U2F_SIGN]: () =>
    import(/* webpackChunkName: "U2fSign" */ 'sentry/components/u2f/u2fsign'),
  [SentryInitRenderReactComponent.SU_STAFF_ACCESS_FORM]: () =>
    import(
      /* webpackChunkName: "SuperuserStaffAccessForm" */ 'sentry/components/superuserStaffAccessForm'
    ),
};

async function processItem(initConfig: OnSentryInitConfiguration) {
  /**
   * Allows our auth pages to dynamically attach a client side password
   * strength indicator The password strength component is very
   * heavyweight as it includes the zxcvbn, a relatively byte-heavy
   * password strength estimation library. Load it on demand.
   */
  if (initConfig.name === 'passwordStrength') {
    const {input, element} = initConfig;
    if (!input || !element) {
      return;
    }
    const inputElem = document.querySelector(input);
    const rootEl = document.querySelector(element);
    if (!inputElem || !rootEl) {
      return;
    }

    const {PasswordStrength} = await import(
      /* webpackChunkName: "PasswordStrength" */ 'sentry/components/passwordStrength'
    );

    const root = createRoot(rootEl);
    inputElem.addEventListener(
      'input',
      throttle(e => {
        root.render(
          /**
           * The screens and components rendering here will always render in light mode.
           * This is because config is not available at this point (user might not be logged in yet),
           * and so we dont know which theme to pick.
           */
          <ThemeAndStyleProvider>
            <PasswordStrength value={e.target.value} />
          </ThemeAndStyleProvider>
        );
      })
    );

    return;
  }

  /**
   * Allows server rendered templates to render a React component to DOM
   * without exposing the component globally.
   */
  if (initConfig.name === 'renderReact') {
    if (!COMPONENT_MAP.hasOwnProperty(initConfig.component)) {
      return;
    }
    const {default: Component} = await COMPONENT_MAP[initConfig.component]();

    renderOnDomReady(() =>
      // TODO(ts): Unsure how to type this, complains about u2fsign's required props
      renderDom(
        (props: any) => (
          /**
           * The screens and components rendering here will always render in light mode.
           * This is because config is not available at this point (user might not be logged in yet),
           * and so we dont know which theme to pick.
           */
          <ThemeAndStyleProvider>
            <Component {...props} />
          </ThemeAndStyleProvider>
        ),
        initConfig.container,
        initConfig.props
      )
    );
  }

  /**
   * Callback for when js bundle is loaded. Provide library + component references
   * for downstream consumers to use.
   */
  if (initConfig.name === 'onReady' && typeof initConfig.onReady === 'function') {
    initConfig.onReady(exportedGlobals);
  }
}

/**
 * This allows server templates to push "tasks" to be run after application has initialized.
 * The global `window.__onSentryInit` is used for this.
 *
 * Be careful here as we can not guarantee type safety on `__onSentryInit` as
 * these will be defined in server rendered templates
 */
export async function processInitQueue() {
  // Currently, this is run *before* anything is queued in
  // `window.__onSentryInit`. We want to provide a migration path for potential
  // custom plugins that rely on `window.SentryApp` so they can start migrating
  // their plugins ASAP, as `SentryApp` will be loaded async and will require
  // callbacks to access it, instead of via `window` global.
  if (
    typeof window.__onSentryInit !== 'undefined' &&
    !Array.isArray(window.__onSentryInit)
  ) {
    return;
  }

  const queued = window.__onSentryInit;

  // Stub future calls of `window.__onSentryInit.push` so that it is
  // processed immediately (since bundle is loaded at this point and no
  // longer needs to act as a queue)
  //
  window.__onSentryInit = {
    push: processItem,
  };

  if (Array.isArray(queued)) {
    // These are all side-effects, so no need to return a value, but allow consumer to
    // wait for all initialization to finish
    await Promise.all(queued.map(processItem));
  }
}
