// This is the entry point of Sentry's frontend application. Want to
// understand how app boots? Read on!
//
// 1. Load the `bootstrap` and `initializeMain` functions
//
//   a. Execute and wait for `bootstrap` to complete.
//
//      Bootstrapping loads early-runtime configuration. See the
//      client_config.py backend view for more details.
//
//      Bootstrapping will do different things depending on if the app is
//      running in SPA mode vs being booted from the django rendered layout
//      template.
//
//      - SPA mode loads client-config via a HTTP request.
//      - Django rendered mode loads client-config from a window global.
//
// 2. Once the app has been bootstrapped with the client-config data we can
//    initialize the app.
//
//   a. The locale module will be initialized using `initializeLocale`. See this
//      function in app/bootstrap/initializeLocale to understand the priority
//      for how it determines the locale
//
//      This also handles lazily loading non English locale files if needed.
//      There is no English locale file as our locale strings are keyed using
//      the English strings.
//
//   b. Call `initalizeApp`, which starts most everything else
//
// 3. App initialization does the following...
//
//   a. Initialize the ConfigStore with client-config data.
//
//   b. Initialize the Sentry SDK. This includes setting up integrations for
//      routing and tracing.
//
//   c. The <Main /> component is rendered. See step 4 for more details.
//
//   d. Run global init-queue tasks. These are essentially functions registered
//      in the `window.__onSentryInit` array from outside of the app. This is
//      specifically for old-style pages rendered as django templates, but
//      still need React frontend components.
//
//      This also includes exporting some globals into the window.
//
// 4. Once the app is fully initialized we begin rendering React components. To
//    understand the rendering tree from this point forward it's best to follow
//    the component tree from <Main />
//
//    For a quick overview, here's what most render trees will look like:
//
//    <ThemeAndStyleProvider>  <-- Provides emotions theme in context
//    |
//    <Router>                 <-- Matches URLs and renders nested views
//    |
//    <App>                    <-- The App view handles initializing basic
//    |                            parts of the application (such as loading
//    |                            your org list)
//    |
//    <OrganizationLayout>     <-- Most routes live within the
//                                 OrganizationLayout, which handles loading
//                                 details for the org, projects, and teams.
//
//
// Did you read through this whole thing and don't even work here? [1]
//
// [1]: https://sentry.io/careers/

async function app() {
  // eslint-disable-next-line no-console
  console.log(
    `%c
    ██████╗ ███████╗███╗   ██╗████████╗██████╗ ██╗   ██╗
   ██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██╔══██╗╚██╗ ██╔╝
   ╚█████╗  █████╗  ██╔██╗ ██║   ██║   ██████╔╝ ╚████╔╝
    ╚═══██╗ ██╔══╝  ██║╚██╗██║   ██║   ██╔══██╗  ╚██╔╝
   ██████╔╝ ███████╗██║ ╚████║   ██║   ██║  ██║   ██║
   ╚═════╝  ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝

   👋 Hey, you opened the console!

   Found a bug?
   Yeah, we probably know about it. We literally built a company
   around finding and fixing bugs. The irony isn't lost on us.

   📚 Docs (we wrote them, please read them): https://docs.sentry.io/
   💬 Ideas? Complaints? Hot takes? https://github.com/getsentry/sentry/discussions

   Like poking around in dev tools? We like that about you.
   We're hiring: https://sentry.io/careers/
   (We have snacks. And opinions about error handling.)
`,
    `color: #6C5FC7; font-family: 'Roboto Mono', Monaco, Consolas, 'Courier New', monospace;`
  );

  // We won't need initalizeMainImport until we complete bootstrapping.
  // Initaite the fetch, just don't await it until we need it.
  const initalizeMainImport = import('sentry/bootstrap/initializeMain');
  const bootstrapImport = import('sentry/bootstrap');

  const {bootstrap} = await bootstrapImport;
  const config = await bootstrap();

  if (config.sentryMode === 'SELF_HOSTED') {
    const {initializeMain} = await initalizeMainImport;
    initializeMain(config);
    return;
  }

  // We have split up the imports this way so that locale is initialized as
  // early as possible, (e.g. before `registerHooks` is imported otherwise the
  // imports in `registerHooks` will not be in the correct locale.
  const registerHooksImport = import('getsentry/registerHooks');
  const initalizeBundleMetricsImport = import('getsentry/initializeBundleMetrics');

  // getsentry augments Sentry's application through a 'hook' mechanism. Sentry
  // provides various hooks into parts of its application. Thus all getsentry
  // functionality is initialized by registering its hook functions.
  const {default: registerHooks} = await registerHooksImport;
  registerHooks();

  const {initializeMain} = await initalizeMainImport;
  initializeMain(config);

  const {initializeBundleMetrics} = await initalizeBundleMetricsImport;
  initializeBundleMetrics();
}

app();
