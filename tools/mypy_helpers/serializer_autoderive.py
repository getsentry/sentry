"""Auto-derive `Serializer[T]` from a typed `serialize()` return.

A mypy plugin hook that, for any bare `class Foo(Serializer):` whose
`serialize(...) -> Concrete` has a non-`Any` return annotation, rewrites the
`Serializer` base Instance to `Serializer[Concrete]` so mypy sees the typed
shape without authors writing `[Concrete]` by hand. Wired into
`SentryMypyPlugin.get_base_class_hook` in `plugin.py`.
"""

from __future__ import annotations

from mypy.nodes import FuncDef
from mypy.plugin import ClassDefContext
from mypy.types import AnyType, CallableType, Instance, Type, UnboundType, get_proper_type

SERIALIZER_FULLNAME = "sentry.api.serializers.base.Serializer"


# Serializers exempt from autoderive. Each entry is a known caller-side
# drift case the typed return shape would surface. The escape valve is to
# migrate the drifting *callers* to `serialize_untyped()` (which returns
# `Any` and documents the per-callsite opt-out), then remove the
# serializer's class-level entry here. The denylist is a transition
# artifact — its end state is empty.
_AUTODERIVE_DENYLIST: frozenset[str] = frozenset(
    {
        "sentry.api.serializers.models.commit.CommitSerializer",
        "sentry.api.serializers.models.event.EventSerializer",
        "sentry.api.serializers.models.group.GroupSerializerBase",
        "sentry.api.serializers.models.organization_member.base.OrganizationMemberSerializer",
        "sentry.api.serializers.models.project.ProjectSerializer",
        "sentry.api.serializers.models.release.ReleaseSerializer",
        "sentry.api.serializers.models.team.BaseTeamSerializer",
        "sentry.users.api.serializers.user.UserSerializer",
    }
)


def autoderive_serializer_generic(ctx: ClassDefContext) -> None:
    """For `class Foo(Serializer):` where Foo defines `serialize(...) -> Concrete`,
    rewrite the `Serializer` base Instance to `Serializer[Concrete]` so mypy
    sees the typed shape — equivalent to authors writing `Serializer[Concrete]`
    by hand.

    Only fires when:
      - The class directly inherits `Serializer` (i.e. has it in its direct
        `info.bases`).
      - The class is not in `_AUTODERIVE_DENYLIST`.
      - The class directly defines `serialize(...)` with a concrete (not `Any`)
        return annotation.

    Skips classes that already parameterize the base (`Serializer[X]`),
    classes that inherit from already-typed Serializer subclasses (no direct
    `Serializer` base in `info.bases`), and classes whose `serialize` is
    unannotated or returns `Any`.
    """
    info = ctx.cls.info
    if info.fullname in _AUTODERIVE_DENYLIST:
        return

    target_idx: int | None = None
    for i, base in enumerate(info.bases):
        if (
            base.type is not None
            and base.type.fullname == SERIALIZER_FULLNAME
            and len(base.args) == 1
            and isinstance(get_proper_type(base.args[0]), AnyType)
        ):
            target_idx = i
            break
    if target_idx is None:
        return

    serialize_ret: Type | None = None
    for stmt in ctx.cls.defs.body:
        if isinstance(stmt, FuncDef) and stmt.name == "serialize":
            if not isinstance(stmt.type, CallableType):
                return
            raw_ret = stmt.type.ret_type
            # `get_base_class_hook` fires while semantic analysis of the class
            # body is in progress; method-level type annotations may still be
            # `UnboundType` (just the parsed name). Run them through
            # `anal_type` so names get bound to their TypeInfo — otherwise we
            # install a broken `Serializer[UnboundType("FooResponse")]` base
            # that mypy renders with a trailing `?` and refuses to index.
            # `anal_type` returns `None` and auto-defers when something isn't
            # ready; bail in that case and let the next pass try again.
            if isinstance(get_proper_type(raw_ret), UnboundType):
                resolved = ctx.api.anal_type(raw_ret)
                if resolved is None:
                    return
                raw_ret = resolved
            ret = get_proper_type(raw_ret)
            if isinstance(ret, AnyType):
                return
            serialize_ret = raw_ret
            break
    if serialize_ret is None:
        return

    base = info.bases[target_idx]
    info.bases[target_idx] = Instance(base.type, [serialize_ret])
