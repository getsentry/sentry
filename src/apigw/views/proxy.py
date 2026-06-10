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


# NOTE: this is defined as first route to catch first paths that should
#       reach control, but due to wider routing rules would instead reach
#       cells through below route `proxy_cell_from_org`
@proxy.route(
    [
        "/api/0/organizations/<str:org>/integrations(/<any:subp>)?",
        "/api/0/organizations/<str:org>/sentry-apps(/<any:subp>)?",
        "/api/0/organizations/<str:org>/sentry-app-installations(/<any:subp>)?",
    ],
    methods=["get", "post", "put", "patch", "delete", "head", "options"],
)
async def proxy_control_from_org(org: str, subp: str | None = None) -> Any:
    return await proxy_control_request(request)


@proxy.route(
    [
        "/api/0/_admin/customers/<str:org>(/<any:subp>)?",
        "/api/0/customers/<str:org>(/<any:subp>)?",
        "/api/0/internal-stats/<str:org>(/<any:subp>)?",
        "/api/0/organizations/<str:org>(/<any:subp>)?",
        "/api/0/projects/<str:org>(/<any:subp>)?",
        "/api/0/teams/<str:org>(/<any:subp>)?",
        "/organizations/<str:org>/billing(/<any:subp>)?",
        "/organizations/<str:org>/payments(/<any:subp>)?",
    ],
    methods=["get", "post", "put", "patch", "delete", "head", "options"],
    pipeline=[db.pipe_ctx],
)
async def proxy_cell_from_org(db_ctx: Any, org: str, subp: str | None = None) -> Any:
    try:
        async with db_ctx.acquire() as db:
            cell = await get_cell_for_organization(db, org)
    except CellResolutionError:
        abort_with_json(404, {"error": "apigateway", "detail": "Not found"})
    return await proxy_cell_request(cell, request)


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


@proxy.route(
    "/api/embed/error-page",
    methods=["get", "post", "put", "patch", "delete", "head", "options"],
)
async def proxy_cell_from_error_embed() -> Any:
    if not request.query_params.dsn:
        abort_with_json(400, {"error": "apigateway", "detail": "Invalid request"})
    try:
        cell = get_cell_from_dsn(request.query_params.dsn, app.config.cells.default)
    except ValueError:
        abort_with_json(400, {"error": "apigateway", "detail": "Invalid request"})
    except CellResolutionError:
        abort_with_json(404, {"error": "apigateway", "detail": "Not found"})
    return await proxy_cell_request(cell, request)


@proxy.route(
    [
        "/api/0/accept-transfer",
        "/api/0/groups/<str:p1>",
        "/api/0/groups/<str:p1>/activities",
        "/api/0/groups/<str:p1>/attachments",
        "/api/0/groups/<str:p1>/comments(/<any:p2>)?",
        "/api/0/groups/<str:p1>/current-release",
        "/api/0/groups/<str:p1>/events(/<any:p2>)?",
        "/api/0/groups/<str:p1>/external-issues(/<any:p2>)?",
        "/api/0/groups/<str:p1>/hashes",
        "/api/0/groups/<str:p1>/integrations(/<any:p2>)?",
        "/api/0/groups/<str:p1>/notes(/<any:p2>)?",
        "/api/0/groups/<str:p1>/reprocessing",
        "/api/0/groups/<str:p1>/similar-issues-embeddings",
        "/api/0/groups/<str:p1>/similar",
        "/api/0/groups/<str:p1>/stats",
        "/api/0/groups/<str:p1>/tags(/<any:p2>)?",
        "/api/0/groups/<str:p1>/user-feedback",
        "/api/0/groups/<str:p1>/user-reports",
        "/api/0/issues/<str:p1>",
        "/api/0/issues/<str:p1>/activities",
        "/api/0/issues/<str:p1>/attachments",
        "/api/0/issues/<str:p1>/comments(/<any:p2>)?",
        "/api/0/issues/<str:p1>/current-release",
        "/api/0/issues/<str:p1>/events(/<any:p2>)?",
        "/api/0/issues/<str:p1>/external-issues(/<any:p2>)?",
        "/api/0/issues/<str:p1>/hashes",
        "/api/0/issues/<str:p1>/integrations(/<any:p2>)?",
        "/api/0/issues/<str:p1>/notes(/<any:p2>)?",
        "/api/0/issues/<str:p1>/reprocessing",
        "/api/0/issues/<str:p1>/similar-issues-embeddings",
        "/api/0/issues/<str:p1>/similar",
        "/api/0/issues/<str:p1>/stats",
        "/api/0/issues/<str:p1>/tags(/<any:p2>)?",
        "/api/0/issues/<str:p1>/user-feedback",
        "/api/0/issues/<str:p1>/user-reports",
        "/api/0/organizations",
        "/api/0/projects",
        "/api/0/relays(/<any:p1>)?",
        "/api/hooks/release(/<any:p1>)?",
        "/js-sdk-loader(/<any:p1>)?",
        "/organization-avatar(/<any:p1>)?",
    ],
    methods=["get", "post", "put", "patch", "delete", "head", "options"],
)
async def proxy_cell_legacy(p1: str | None = None, p2: str | None = None) -> Any:
    try:
        cell = get_cell_by_name(app.config.cells.default)
    except CellResolutionError:
        abort_with_json(404, {"error": "apigateway", "detail": "Not found"})
    return await proxy_cell_request(cell, request)


@proxy.route(
    "/<any:p>",
    methods=["get", "post", "put", "patch", "delete", "head", "options"],
)
async def proxy_control(p: str) -> Any:
    return await proxy_control_request(request)
