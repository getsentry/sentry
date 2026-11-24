from __future__ import annotations

# The owner for a finding no team can be found for. It's an ApiOwner value, and it routes to the
# API platform team
UNOWNED = "unowned"


def _class_of(scope: str) -> str | None:
    """The class part of a scope like "Class.method", or None for a module-level function."""
    if "." not in scope:
        return None
    return scope.split(".", 1)[0]


def owner_for(
    path: str, scope: str, caller: str | None, owner_map: dict[str, dict[str, str]]
) -> str:
    """Finds the team that owns a violation that flake caught.
    `path` the path of the file where the violation belongs to
    `scope` where the finding is i.e, `Endpoint.get` meaning the finding is in the class Endpoint and specifically in it's get method.
    If the violation is found in a helper function and not an endpoint's http method, the scope becomes the name of the helper i.e, "helper"
    `caller` the scope of the first public endpoint method that calls a helper, where the violation happens within the helper
    `owner_map` is the owner map from `make api-owner-map`: {path: {endpoint class: owner}}. It only
    has routed endpoint classes, so a violation inside a module-level helper, or a helper on a base
    class that isn't routed falls back to the class of `caller`, the public method that reached it

    Returns "unowned" when neither class is in the owner map
    """
    owners = owner_map.get(path, {})

    scope_class = _class_of(scope)
    if scope_class is not None and scope_class in owners:
        return owners[scope_class]

    # the public method that called the helper
    if caller is not None:
        caller_class = _class_of(caller)
        if caller_class is not None and caller_class in owners:
            return owners[caller_class]

    return UNOWNED
