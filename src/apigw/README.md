# apigw

A silo-aware routing proxy sitting in front of `sentry.io`.

## Purpose

In Sentry's cell architecture, customer traffic landing on `sentry.io` (the
control silo domain) is not necessarily meant to be served by the control
silo: org-scoped API requests belong to the cell owning that organization,
and a set of legacy paths is pinned to the default (US) cell. `apigw`
terminates that traffic and forwards every request to the right place —
control, the org's cell, or the default cell — based on the `SiloMode` of the
Django view registered for the path.

Locality domains (`us.sentry.io`, `de.sentry.io`, ...) are out of scope:
those are routed to cells by Synapse in the relevant locales.

## Why not Django

Sentry already ships a gateway doing this job: `ApiGatewayMiddleware`
(`src/sentry/hybridcloud/apigateway/`), which runs _inside_ the control
silo's Django process. That shape has a structural cost: every proxied
request still pays for the full Django request cycle on control (middleware
stack, URL resolution) before the proxying even starts, and each in-flight
proxy holds a worker for its whole duration. A gateway's job is moving bytes
between sockets — it's I/O bound, with potentially thousands of concurrent
long-lived requests (file uploads, event payloads, streamed responses). The
async middleware variant (`src/sentry/hybridcloud/apigateway_async/`) was
not sufficient either, as it remains bound to Django's request lifecycle and
to the monolith's runtime.

`apigw` is instead a thin async service built on
[emmett55](https://github.com/emmett-framework/emmett55):

- requests and responses are **streamed** in both directions (`httpx` async
  client, chunked bodies), so concurrency is bounded by sockets and memory,
  not workers;
- route matching uses emmett's Rust-based router
- cell lookups run on **asyncpg** with a dedicated pool.

It still reuses sentry's code where consistency matters: Django settings and
the cell directory (`sentry.types.cell`) are imported directly, and the
`OrganizationMapping` lookup is _built_ with the Django ORM
(`sql_with_params()`) but _executed_ on asyncpg (see `db.pgq_from_djq`), so
queries can't drift from the sentry models. The Django bootstrap lives in
`config.py` and is skipped when the host process (e.g. pytest) already
initialized Django.

## How it differs from the `ApiGatewayMiddleware` flow

|                                       | `ApiGatewayMiddleware`                                                    | `apigw`                                                      |
| ------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Where the decision runs               | inside control's Django, after middleware + URL resolution                | in the proxy tier, before any Django process                 |
| Routing input                         | resolved view's `silo_limit` + `REGION_PINNED_URL_NAMES` + cell resolvers | explicit route table (`views/proxy.py`)                      |
| Cell lookup                           | Django ORM, sync                                                          | `OrganizationMapping` via asyncpg                            |
| Control silo cost per proxied request | full request cycle + sync proxy                                           | none (control only sees control-bound traffic)               |
| Backpressure                          | none                                                                      | per-cell circuit breakers (concurrency cap + failure window) |

During the migration the middleware stays in place as a fallback: anything
`apigw` routes to control that control can't serve natively (e.g. the
js-sdk-loader, which needs public-key based cell resolution) is still
forwarded by the middleware. `tests/apigw/test_routing.py` enforces parity:
it materializes every customer-facing Django URL and asserts `apigw` routes
it to a destination compatible with the view's `SiloMode`, with drainable
registries (`KNOWN_MISROUTED`, `KNOWN_MISLEADING`) tracking the deliberate
exceptions.

### Route definition rules

emmett55 matches routes in **definition order** and we want to avoid
negative look-ahead regex rules complexity.
Carve-outs are therefore expressed by ordering: stricter
paths are registered first, wider rules after (e.g. the cell-scoped
`integrations/coding-agents` route is defined before the control-scoped
`integrations/<str:subp>` rule). This produces a "cell-control dance" in
`views/proxy.py`, but keeps every individual path simple. Legacy paths
starting with a bare org slug are registered last, right before the control
catch-all, so they can't shadow unrelated paths.

## Package structure

```
apigw/
├── __init__.py        app instance + extensions (Prometheus, Sentry, AsyncPG)
├── config.py          env-based configuration + sentry/django bootstrap
├── db.py              asyncpg pool (emmett extension/pipes) and the
│                      django-SQL -> asyncpg placeholders adapter
├── dsl.py             cell resolution: org mapping lookup, DSN parsing,
│                      re-exports of sentry.types.cell
├── circuitbreaker.py  per-target concurrency cap + failure-window breaker
├── proxy.py           the proxy engine: streaming httpx client, header
│                      filtering/forwarding, timeout overrides, metrics
├── utils.py           various utilities
├── web.py             entrypoint module (exposes `app`)
└── views/
    ├── proxy.py       the routing table: cell/control routes in match order
    └── _internal.py   health endpoint, served on the internal hostname
```

Configuration is environment-driven (`APIGW_*` variables, see `config.py`);
the most relevant ones are `APIGW_ENDPOINT_CONTROL` (control silo address),
`APIGW_DB_POOL_SIZE` and the `APIGW_PROXY_*` family (timeouts, concurrency,
circuit breaker thresholds). The default cell comes from
`settings.SENTRY_MONOLITH_REGION`.

## Tests

The suite lives in `tests/apigw/` and runs in CI on every backend change:

- `test_routing.py` — the routing parity test described above: every
  customer-facing Django URL must be routed by `apigw` to a destination
  compatible with the view's `SiloMode`.
- `test_db.py` — the cell lookup query builder produces asyncpg-compatible
  SQL (`$n` placeholders, no django `%s` left, `LIMIT` applied) from the
  sentry models.
- `test_proxy.py` — proxy internals against fakes (no network): request
  header filtering and forwarding, and upstream response adaptation —
  including that multiple `set-cookie` headers survive as separate,
  unmangled header lines once emmett renders the final response.

## Development

A working sentry dev config (`~/.sentry`) and the devservices postgres are
required, since `apigw` bootstraps Django settings and reads
`OrganizationMapping` from the sentry database.

```bash
# run the development server (reloader included)
emmett55 -a apigw.web develop

# inspect the compiled routing table
emmett55 -a apigw.web routes

# run the test suite
pytest tests/apigw
```
