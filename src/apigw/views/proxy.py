from emmett55 import abort, request, response

from .. import app, db, json
from ..dsl import CellResolutionError, get_cell_by_name, get_cell_for_organization
from ..proxy import proxy_cell_request, proxy_control_request

proxy = app.module(__name__, "proxy")


@proxy.route(
    [
        "/api/0/organizations/<str:org>(/<any:subp>)?",
        "/api/0/projects/<str:org>(/<any:subp>)?",
        "/api/0/teams/<str:org>(/<any:subp>)?",
        "/api/0/customers/<str:org>(/<any:subp>)?",
        "/api/0/_admin/customers/<str:org>(/<any:subp>)?",
        "/api/0/internal-stats/<str:org>(/<any:subp>)?",
        "/organizations/<str:org>/billing(/<any:subp>)?",
        "/organizations/<str:org>/payments(/<any:subp>)?",
    ],
    methods=["get", "post", "put", "patch", "delete", "head", "options"],
    pipeline=[db.pipe_ctx],
)
async def proxy_cell_from_org(db_ctx, org: str, subp: str | None = None):
    try:
        async with db_ctx.acquire() as db:
            cell = await get_cell_for_organization(db, org)
    except CellResolutionError:
        response.content_type = "application/json"
        abort(404, json({"error": "apigateway", "detail": "Not found"}))
    return await proxy_cell_request(cell, request)


@proxy.route(
    "/api/0/_admin/cells/<str:cell>(/<any:subp>)?",
    methods=["get", "post", "put", "patch", "delete", "head", "options"],
)
async def proxy_cell_from_id(cell: str, subp: str | None = None):
    try:
        cell = get_cell_by_name(cell)
    except CellResolutionError:
        response.content_type = "application/json"
        abort(404, json({"error": "apigateway", "detail": "Not found"}))
    return await proxy_cell_request(cell, request)


@proxy.route(
    "/<any:p>",
    methods=["get", "post", "put", "patch", "delete", "head", "options"],
)
async def proxy_control(p: str):
    return await proxy_control_request(request)
