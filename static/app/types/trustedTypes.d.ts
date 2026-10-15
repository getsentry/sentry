// The DOM lib types these Trusted Types sinks as string-only, so these
// overloads let the trusted values reach them without an assertion.

interface ServiceWorkerContainer {
  register(
    scriptURL: TrustedScriptURL,
    options?: RegistrationOptions
  ): Promise<ServiceWorkerRegistration>;
}
