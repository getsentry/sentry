from .. import app

internal = app.module(__name__, "internal", hostname=app.config.internal_fqdn)


@internal.route("/_health", methods=["get"], output="bytes")
async def health() -> bytes:
    return b"ok"
