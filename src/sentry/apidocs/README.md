# Operation routing metadata

The public OpenAPI output includes `x-sentry-routing` on each operation:

```json
{
  "x-sentry-routing": {
    "silo": "cell",
    "organizationParameter": "organization_id_or_slug"
  }
}
```

`silo` describes the endpoint class's declared availability:

| Value     | Meaning                                                                      |
| --------- | ---------------------------------------------------------------------------- |
| `control` | Declared for control silo.                                                   |
| `cell`    | Declared for cell silo.                                                      |
| `both`    | Declared for control and cell; callers must preserve their intended context. |
| `unknown` | No matching declaration that identifies control/cell availability.           |

This is not a preferred destination, a gateway-support guarantee, or a promise
that every handler behaves identically in those contexts. For example,
`GET /organizations/` has `both` availability, but control returns an authorized
global catalog and a cell returns its local catalog. Handlers can impose further
method-specific restrictions. Monolith deployments retain their existing behavior.

`organizationParameter`, when present, names the generated path parameter that
identifies the organization. It must also occur in the canonical path. The names
come from the organization kwargs understood by the backend gateway, rather than
prefixes such as `/organizations/`, `/projects/`, or `/teams/`. A control operation
can have an organization parameter. Missing or ambiguous parameter metadata does
not invent one.

The hooks collect declarations by path and HTTP method, including existing legacy
operations whose paths can be matched reliably. Unmatched operations stay
`unknown`. Collection resets on every schema build, including the omission guard's
baseline build. Issue aliases retain metadata through canonicalization, and the
extension is preserved when the schema is dereferenced. Publication rules, request
and response schemas, and runtime routing are unchanged.

SDK generators can embed these facts without an additional metadata request.
An organization's public locality URL remains runtime information supplied by
bootstrap, configuration, organization listings (`links.regionUrl`), or optional
discovery. This extension contains no deployment URLs, credentials, private cell
addresses, cache policy, or automatic host selection.

# Idempotent operations

Every endpoint that publishes a `POST`, `PUT`, `PATCH`, or `DELETE` must declare
`idempotent_methods`, and the build fails if it doesn't. An operation carries
`"x-sentry-idempotent": true` when its endpoint lists the method there:

```python
class DifAssembleEndpoint(ProjectEndpoint):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}
    idempotent_methods = frozenset({"POST"})
```

It means a client may resend the identical request after a timeout or a 5xx
response without changing the outcome, so generated clients can retry it like a
`GET`. Only list methods that are not already safe (RFC 9110 §9.2.1): the build
fails for `GET`, `HEAD`, `OPTIONS`, `TRACE`, or a method the endpoint does not
declare in `publish_status`. Use `idempotent_methods = frozenset()` when none of
the endpoint's writes are safe to resend. A missing marker means "not known to be
idempotent", including `PUT` and `DELETE`, whose handlers do not all live up to
RFC 9110 §9.2.2.

List a method only when resending the identical request after the first one
succeeded leaves the same state, writes no new rows, audit log entries, or
Activity, sends no email or webhook, queues no task that doesn't converge, and
does not return an error. A `DELETE` that answers a resend with 404 does not
qualify yet.

Like routing, declarations are collected for every endpoint and reset on every
build. The marker appears only on operations that are in the generated schema.
