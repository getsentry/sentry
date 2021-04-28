/**
 * This allows server templates to push "tasks" to be run after application has initialized.
 * The global `window.__onSentryInit` is used for this.
 */
export async function processInitQueue() {
  if (!Array.isArray(window.__onSentryInit)) {
    return;
  }

  await Promise.all(
    /**
     * Be careful here as we can not guarantee type safety on `__onSentryInit` as
     * these will be defined in server rendered templates
     */
    window.__onSentryInit.map(async initConfig => {
      if (initConfig.name === 'passwordStrength') {
        const {input, element} = initConfig;
        if (!input || !element) {
          return;
        }

        // The password strength component is very heavyweight as it includes the
        // zxcvbn, a relatively byte-heavy password strength estimation library. Load
        // it on demand.
        const passwordStrength = await import(
          /* webpackChunkName: "passwordStrength" */ 'app/components/passwordStrength'
        );

        passwordStrength.attachTo({
          input: document.querySelector(input),
          element: document.querySelector(element),
        });

        return;
      }

      if (initConfig.name === 'renderIndicators') {
        const {renderIndicators} = await import(
          /* webpackChunkName: "renderIndicators" */ 'app/bootstrap/renderIndicators'
        );
        renderIndicators(initConfig.container, initConfig.props);

        return;
      }

      if (initConfig.name === 'renderSystemAlerts') {
        const {renderSystemAlerts} = await import(
          /* webpackChunkName: "renderSystemAlerts" */ 'app/bootstrap/renderSystemAlerts'
        );
        renderSystemAlerts(initConfig.container, initConfig.props);

        return;
      }
    })
  );
}
