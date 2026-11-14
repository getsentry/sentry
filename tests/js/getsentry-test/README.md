# GetSentry test support

This private workspace owns billing fixtures and billing-specific Jest setup.
Its dependencies include the GetSentry and Sentry apps, and the Sentry test
package through the `sentry-fixture` alias.

The root exposes it through the `getsentry-test` workspace alias. Existing
`getsentry-test/fixtures/*` imports use package exports. Add an export in
`package.json` when adding a fixture or helper.

Specs stay alongside application source and run through the root test command.
Billing setup runs before the common setup so its mocks are installed before
application modules load.
