from typing import Any

from emmett55 import request

from .. import app, db
from ..dsl import (
    CellResolutionError,
    get_cell_by_name,
    get_cell_for_organization,
    get_cell_from_dsn,
)
from ..proxy import ProxyLatencyPipe, proxy_cell_request, proxy_control_request
from ..utils import abort_with_json

proxy = app.module(__name__, "proxy")
proxy.pipeline = [ProxyLatencyPipe()]


# NOTE: The structure of this file depends on two things:
#         - there's no clear silo-mode hierarchy in routes
#         - emmett55 routing strategy follows the route definition order
#       Given the above, and for everybody's mental sanity, we avoid
#       rules with negative look-ahead regexes, and instead take advantage
#       of the definition order to route more strict paths first and wider
#       rules afterwise. The negative about this, is that we end-up having
#       a "cell-control dance" in routes definitions here, but the pro
#       is simpler paths, so should be overall easier to follow in terms
#       of urls.


# Common cell from org id/slug code
async def proxy_cell_from_org(db_ctx: Any, org: str, **kwargs: Any) -> Any:
    try:
        async with db_ctx.acquire() as db:
            cell = await get_cell_for_organization(db, org)
    except CellResolutionError:
        abort_with_json(404, {"error": "apigateway", "detail": "Not found"})
    return await proxy_cell_request(cell, request)


# NOTE: this is defined before `proxy_control_from_org` since coding-agents is
#       a cell endpoint living under the org integrations path, which is
#       otherwise routed to control
proxy.route(
    "/api/0/organizations/<str:org>/integrations/coding-agents",
    methods=["get", "post", "put", "patch", "delete", "head", "options"],
    pipeline=[db.pipe_ctx],
    name="proxy_cell_from_org_integrations",
)(proxy_cell_from_org)


# NOTE: this is defined before other cells routes to catch paths that should
#       reach control, but due to wider routing rules would instead reach
#       cells through below route `proxy_cell_from_org`
@proxy.route(
    [
        "/api/0/organizations/<str:org>/api-keys(/<any:subp>)?",
        "/api/0/organizations/<str:org>/audit-logs",
        "/api/0/organizations/<str:org>/broadcasts",
        "/api/0/organizations/<str:org>/data-secrecy",
        "/api/0/organizations/<str:org>/integrations",
        "/api/0/organizations/<str:org>/integrations/<str:subp>",
        "/api/0/organizations/<str:org>/integrations/<str:subp>/channel-validate",
        "/api/0/organizations/<str:org>/integrations/<str:subp>/channels",
        "/api/0/organizations/<str:org>/integrations/<str:subp>/repo-sync",
        "/api/0/organizations/<str:org>/integrations/direct-enable(/<any:subp>)?",
        "/api/0/organizations/<str:org>/intercom-jwt",
        "/api/0/organizations/<str:org>/org-auth-tokens(/<any:subp>)?",
        "/api/0/organizations/<str:org>/pipeline/<str:subp>",
        "/api/0/organizations/<str:org>/sentry-app-components",
        "/api/0/organizations/<str:org>/sentry-app-installations(/<any:subp>)?",
        "/api/0/organizations/<str:org>/sentry-apps(/<any:subp>)?",
    ],
    methods=["get", "post", "put", "patch", "delete", "head", "options"],
)
async def proxy_control_from_org(**kwargs: Any) -> Any:
    return await proxy_control_request(request)


# Route to cells based on org id/slug
proxy.route(
    [
        "/api/0/_admin/customers/<str:org>(/<any:subp>)?",
        "/api/0/customers/<str:org>(/<any:subp>)?",
        "/api/0/internal-stats/<str:org>(/<any:subp>)?",
        "/api/0/organizations/<str:org>(/<any:subp>)?",
        "/api/0/projects/<str:org>(/<any:subp>)?",
        "/api/0/teams/<str:org>(/<any:subp>)?",
        "/organizations/<str:org>/billing(/<any:subp>)?",
        "/organizations/<str:org>/issues/<str:p1>/events/<str:p2>/json",
        "/organizations/<str:org>/payments(/<any:subp>)?",
        "/organizations/<str:org>/projects/<str:p1>/events/<str:p2>",
        "/organizations/<str:org>/projects/<str:p1>/issues/<str:p2>/tags/<str:p3>/export",
        "/plugins/bitbucket/organizations/<str:org>/webhook",
        "/plugins/github/organizations/<str:org>/webhook",
        "/team-avatar/<str:org>(/<any:subp>)?",
        "/toolbar/<str:org>(/<any:subp>)?",
    ],
    methods=["get", "post", "put", "patch", "delete", "head", "options"],
    pipeline=[db.pipe_ctx],
)(proxy_cell_from_org)


# Route to cells based on cell id
@proxy.route(
    "/api/0/_admin/cells/<str:cell_name>(/<any:subp>)?",
    methods=["get", "post", "put", "patch", "delete", "head", "options"],
)
async def proxy_cell_from_id(cell_name: str, subp: str | None = None) -> Any:
    try:
        cell = get_cell_by_name(cell_name)
    except CellResolutionError:
        abort_with_json(404, {"error": "apigateway", "detail": "Not found"})
    return await proxy_cell_request(cell, request)


# Route to cells based on `dsn` query param
@proxy.route(
    "/api/embed/error-page",
    methods=["get", "post", "put", "patch", "delete", "head", "options"],
)
async def proxy_cell_from_dsn_qp() -> Any:
    if not request.query_params.dsn:
        abort_with_json(400, {"error": "apigateway", "detail": "Invalid request"})
    try:
        cell = get_cell_from_dsn(request.query_params.dsn, app.config.cells.default)
    except ValueError:
        abort_with_json(400, {"error": "apigateway", "detail": "Invalid request"})
    except CellResolutionError:
        abort_with_json(404, {"error": "apigateway", "detail": "Not found"})
    return await proxy_cell_request(cell, request)


# NOTE: this route is define to handle legacy paths, where there's no info
#       to get the cell and thus we imply the default cell.
@proxy.route(
    [
        "/api/0/accept-transfer",
        "/api/0/groups/<str:p1>",
        "/api/0/groups/<str:p1>/activities",
        "/api/0/groups/<str:p1>/attachments",
        "/api/0/groups/<str:p1>/autofix(/<any:p2>)?",
        "/api/0/groups/<str:p1>/comments(/<any:p2>)?",
        "/api/0/groups/<str:p1>/current-release",
        "/api/0/groups/<str:p1>/events(/<any:p2>)?",
        "/api/0/groups/<str:p1>/external-issues(/<any:p2>)?",
        "/api/0/groups/<str:p1>/hashes",
        "/api/0/groups/<str:p1>/integrations(/<any:p2>)?",
        "/api/0/groups/<str:p1>/notes(/<any:p2>)?",
        "/api/0/groups/<str:p1>/plugin(/<any:p2>)?",
        "/api/0/groups/<str:p1>/plugins(/<any:p2>)?",
        "/api/0/groups/<str:p1>/related-issues",
        "/api/0/groups/<str:p1>/reprocessing",
        "/api/0/groups/<str:p1>/similar-issues-embeddings",
        "/api/0/groups/<str:p1>/similar",
        "/api/0/groups/<str:p1>/stats",
        "/api/0/groups/<str:p1>/summarize",
        "/api/0/groups/<str:p1>/tags(/<any:p2>)?",
        "/api/0/groups/<str:p1>/user-feedback",
        "/api/0/groups/<str:p1>/user-reports",
        "/api/0/issues/<str:p1>",
        "/api/0/issues/<str:p1>/activities",
        "/api/0/issues/<str:p1>/attachments",
        "/api/0/issues/<str:p1>/autofix(/<any:p2>)?",
        "/api/0/issues/<str:p1>/comments(/<any:p2>)?",
        "/api/0/issues/<str:p1>/current-release",
        "/api/0/issues/<str:p1>/events(/<any:p2>)?",
        "/api/0/issues/<str:p1>/external-issues(/<any:p2>)?",
        "/api/0/issues/<str:p1>/hashes",
        "/api/0/issues/<str:p1>/integrations(/<any:p2>)?",
        "/api/0/issues/<str:p1>/notes(/<any:p2>)?",
        "/api/0/issues/<str:p1>/plugin(/<any:p2>)?",
        "/api/0/issues/<str:p1>/plugins(/<any:p2>)?",
        "/api/0/issues/<str:p1>/related-issues",
        "/api/0/issues/<str:p1>/reprocessing",
        "/api/0/issues/<str:p1>/similar-issues-embeddings",
        "/api/0/issues/<str:p1>/similar",
        "/api/0/issues/<str:p1>/stats",
        "/api/0/issues/<str:p1>/summarize",
        "/api/0/issues/<str:p1>/tags(/<any:p2>)?",
        "/api/0/issues/<str:p1>/user-feedback",
        "/api/0/issues/<str:p1>/user-reports",
        "/api/0/projects",
        "/api/0/relays(/<any:p1>)?",
        "/api/0/seer/models",
        "/api/0/users/<str:p1>/organizations",
        "/api/hooks/release(/<any:p1>)?",
        "/issues/<str:p1>/<str:p2>/tags/<str:p3>/export",
        "/organization-avatar(/<any:p1>)?",
    ],
    methods=["get", "post", "put", "patch", "delete", "head", "options"],
)
async def proxy_cell_legacy(**kwargs: Any) -> Any:
    try:
        cell = get_cell_by_name(app.config.cells.default)
    except CellResolutionError:
        abort_with_json(404, {"error": "apigateway", "detail": "Not found"})
    return await proxy_cell_request(cell, request)


# NOTE: legacy org/project shortlinks start with a bare org slug, so they are
#       registered after every other route: their leading <str:org> segment
#       would otherwise match unrelated paths
#       (e.g. /api/0/issues/... with org="api")
proxy.route(
    [
        "/<str:org>/<str:p1>/issues/<int:p2>/tags/<str:p3>/export",
        "/<str:org>/<str:p1>/issues/<int:p2>/actions/<str:p3>",
        "/<str:org>/<str:p1>/events/<str:p2>",
    ],
    methods=["get", "post", "put", "patch", "delete", "head", "options"],
    pipeline=[db.pipe_ctx],
    name="proxy_cell_from_org_legacy_shortlinks",
)(proxy_cell_from_org)


@proxy.route(
    "/<any:p>",
    methods=["get", "post", "put", "patch", "delete", "head", "options"],
)
async def proxy_control(**kwargs: Any) -> Any:
    return await proxy_control_request(request)
