# Dev Toolbar

This folder contains a PoC for what a Dev Toolbar product would look like and what features it could have.

This is not production ready. Only Sentry employees should be able to see this code, while they're on sentry.io or running a development environment. In order for this to be production-ready for customers to install on their own website, it would need to be bundled similar to the SDK or Spotlight. There are many steps remaining to get there.

Therefore, this is built with maximum portability in mind. It is a goal for this to have as few dependencies on sentry/getsentry as possible to make the majority of the code easy to port into a different repo when/if the PoC is successful. However, some code will not be portable, which is why we're leveraging sentry to host the PoC. For example:

- The API calls themselves are not portable. We're using sentry/getsentry to explicitly avoid solving the API-Auth problem right now.
- Logo assets will need to be copied over, or inserted into platformicons
- Any complex CSS that cannot be inlined. This folder prefers to use inline `style={}` attributes which gives us maximum flexibility to choose a style library when this is extracted. `styled()` calls are used sparingly.
