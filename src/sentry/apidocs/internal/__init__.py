"""The internal OpenAPI build: every endpoint method Sentry serves, published or not.

The published build (`make build-spectacular-docs`) describes only published methods,
for the public API reference. This one describes all of them, for internal consumers
such as frontend type generation, and is never published. `make build-internal-api-docs`
runs it, by handing drf-spectacular's `spectacular` command
`--generator-class sentry.apidocs.internal.InternalGenerator`.

It is the published build, with the same hooks, checks, and settings, except that:

- Nothing is omitted. Fields kept out of the public reference with
  `omit_from_public_schema` (and TypedDict `exclude_fields` that declare a reason) are
  described, since the backend sends them. With no omissions, it builds once, without
  the published build's second build checking them.
- Every method is admitted, whatever its publish status, and stamped with it as
  `x-sentry-publish-status`. The published reference's own checks (tags,
  descriptions, unique summaries) skip unpublished operations.
- A literal alternation in a route, such as `(?:issues|groups)`, is spelled as its
  first branch rather than `{var}`, so routes that differ only there stay apart. Every
  path such a route answers on is listed under `x-sentry-path-aliases`.
- A response no `@extend_schema` declares is read from the handler's `Response[T]`
  annotation, or marked `x-sentry-undocumented`.
- TypedDicts are closed objects, the null member of an optional union admits only null,
  and a type hint that cannot be resolved becomes an `x-sentry-unresolved` placeholder
  instead of failing the build.

`InternalGenerator` switches all of this on for the duration of its own build, through
parameters of the shared hooks and `spectacular_ports.TypeHintPolicy`, whose defaults are
the published build's. The published build never sees any of it.
"""

from sentry.apidocs.internal.generator import (
    PATH_ALIASES_EXTENSION,
    PUBLISH_STATUS_EXTENSION,
    InternalGenerator,
)
from sentry.apidocs.internal.response_annotations import UNDOCUMENTED_EXTENSION
from sentry.apidocs.spectacular_ports import UNRESOLVED_EXTENSION

__all__ = (
    "InternalGenerator",
    "PATH_ALIASES_EXTENSION",
    "PUBLISH_STATUS_EXTENSION",
    "UNDOCUMENTED_EXTENSION",
    "UNRESOLVED_EXTENSION",
)
