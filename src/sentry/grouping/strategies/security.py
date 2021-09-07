from typing import Any

from sentry.eventstore.models import Event
from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.base import (
    GroupingContext,
    ReturnedVariants,
    produces_variants,
    strategy,
)
from sentry.interfaces.security import Csp, ExpectCT, ExpectStaple, Hpkp, SecurityReport


def _security_v1(
    reported_id: str, obj: SecurityReport, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    return {
        context["variant"]: GroupingComponent(
            id=reported_id,
            values=[
                GroupingComponent(id="salt", values=[reported_id]),
                GroupingComponent(id="hostname", values=[obj.hostname]),
            ],
        )
    }


@strategy(ids=["expect-ct:v1"], interface=ExpectCT, score=1000)
@produces_variants(["default"])
def expect_ct_v1(
    interface: ExpectCT, event: Event, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    return _security_v1("expect-ct", interface, context=context, **meta)


@strategy(ids=["expect-staple:v1"], interface=ExpectStaple, score=1001)
@produces_variants(["default"])
def expect_staple_v1(
    interface: ExpectStaple, event: Event, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    return _security_v1("expect-staple", interface, context=context, **meta)


@strategy(ids=["hpkp:v1"], interface=Hpkp, score=1002)
@produces_variants(["default"])
def hpkp_v1(
    interface: Hpkp, event: Event, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    return _security_v1("hpkp", interface, context=context, **meta)


@strategy(ids=["csp:v1"], interface=Csp, score=1003)
@produces_variants(["default"])
def csp_v1(interface: Csp, event: Event, context: GroupingContext, **meta: Any) -> ReturnedVariants:
    violation_component = GroupingComponent(id="violation")
    uri_component = GroupingComponent(id="uri")

    if interface.local_script_violation_type:
        violation_component.update(values=["'%s'" % interface.local_script_violation_type])
        uri_component.update(
            contributes=False,
            hint="violation takes precedence",
            values=[interface.normalized_blocked_uri],
        )
    else:
        violation_component.update(contributes=False, hint="not a local script violation")
        uri_component.update(values=[interface.normalized_blocked_uri])

    return {
        context["variant"]: GroupingComponent(
            id="csp",
            values=[
                GroupingComponent(id="salt", values=[interface.effective_directive]),
                violation_component,
                uri_component,
            ],
        )
    }
