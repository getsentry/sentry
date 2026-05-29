# The flamegraph payload is proxied verbatim from the profiling service, so the
# nested frame / profile / metadata objects are intentionally left open
# (`dict[str, Any]`): their shape is platform-dependent and owned by that service,
# and closing them here would publish a schema stricter than reality. Only the
# stable top-level envelope and the `shared` wrapper's key set are typed.
from typing import Any, TypedDict


class FlamegraphSharedOptional(TypedDict, total=False):
    frame_infos: list[dict[str, Any]]
    profiles: list[dict[str, Any]]


class FlamegraphShared(FlamegraphSharedOptional):
    frames: list[dict[str, Any]]


class OrganizationProfilingFlamegraphResponseOptional(TypedDict, total=False):
    activeProfileIndex: int
    metrics: list[dict[str, Any]] | None


class OrganizationProfilingFlamegraphResponse(OrganizationProfilingFlamegraphResponseOptional):
    metadata: dict[str, Any]
    platform: str
    transactionName: str
    projectID: int
    profiles: list[dict[str, Any]]
    shared: FlamegraphShared
