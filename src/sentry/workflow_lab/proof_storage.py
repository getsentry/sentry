"""Give the isolated Seer proof process access to a rollback-only Sentry transaction."""

import socket
from collections.abc import Iterator
from contextlib import contextmanager
from uuid import UUID

import orjson
from django.contrib.sessions.middleware import SessionMiddleware
from django.db import connections, router, transaction
from django.test import RequestFactory

from sentry.investigations.endpoints.workflow_storage import WorkflowStorageEndpoint
from sentry.investigations.models import WorkflowRun
from sentry.investigations.services.workflow_runtime import claim_due_nodes
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.viewer_context import Actor, ActorType, ViewerContext, encode_viewer_context


def _serve(sock: socket.socket, org: int, keep: bool) -> None:
    alias = router.db_for_write(WorkflowRun)
    factory = RequestFactory()
    system = encode_viewer_context(
        ViewerContext(actor=Actor(type=ActorType.SYSTEM), organization_id=org)
    )
    endpoint = WorkflowStorageEndpoint.as_view()
    completed = False
    run_id = None
    try:
        with transaction.atomic(using=alias), sock.makefile("rwb") as stream:
            for line in stream:
                call = orjson.loads(line)
                method = call["method"]
                key = UUID(call["key"])
                if method == "POST" and run_id is None:
                    if (
                        call["body"]["definition"].get("notebook")
                        or WorkflowRun.objects.filter(uuid=key).exists()
                    ):
                        raise ValueError("Recovery requires a fresh data-only workflow")
                    run_id = key
                if run_id is None:
                    raise ValueError("Create a recovery run before accessing its checkpoints")
                if (
                    key != run_id
                    and not WorkflowRun.objects.filter(
                        organization_id=org, uuid=run_id, nodes__uuid=key
                    ).exists()
                ):
                    raise ValueError("Unknown recovery checkpoint")
                if method == "DUE":
                    run = WorkflowRun.objects.get(organization_id=org, uuid=run_id)
                    claim = claim_due_nodes(org, run=run)
                    claim.acknowledge()
                    data, status = claim.node_ids, 200
                elif method == "FINISH":
                    completed = True
                    data, status = None, 200
                else:
                    path = f"/api/0/organizations/{org}/investigation-workflows/storage/{key}/"
                    request = factory.generic(
                        method,
                        path,
                        data=orjson.dumps(call.get("body")),
                        content_type="application/json",
                        query_params={"node": "1"} if call.get("node") else call.get("query") or {},
                        HTTP_X_VIEWER_CONTEXT=system,
                    )
                    SessionMiddleware(endpoint).process_request(request)
                    result = endpoint(request, organization_id_or_slug=str(org), key=str(key))
                    content = result.render().content
                    data = orjson.loads(content) if content else None
                    status = result.status_code
                stream.write(orjson.dumps({"status": status, "data": data}) + b"\n")
                stream.flush()
            if not (keep and completed):
                transaction.set_rollback(True, using=alias)
    finally:
        sock.close()
        connections.close_all()


@contextmanager
def proof_storage(org: int, keep: bool) -> Iterator[int]:
    # Only the launched child inherits this socket. Other workers cannot see the
    # synthetic run, even while a recovery scenario deliberately expires its leases.
    parent, child = socket.socketpair()
    # The child process timeout bounds the simulation, including cold Seer startup.
    parent.setblocking(True)
    child.setblocking(True)
    with parent, child, ContextPropagatingThreadPoolExecutor(max_workers=1) as executor:
        serving = executor.submit(_serve, parent, org, keep)
        try:
            yield child.fileno()
        finally:
            child.close()
            serving.result()
