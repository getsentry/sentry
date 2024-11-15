from typing import Any

from sentry.eventstore.models import Event
from sentry.grouping.component import BaseGroupingComponent
from sentry.grouping.strategies.base import (
    GroupingContext,
    ReturnedVariants,
    produces_variants,
    strategy,
)
from sentry.interfaces.security import Csp, ExpectCT, ExpectStaple, Hpkp


@strategy(ids=["expect-ct:v1"], interface=ExpectCT, score=1000)
@produces_variants(["default"])
def expect_ct_v1(
    interface: ExpectCT, event: Event, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    return {
        context["variant"]: BaseGroupingComponent(
            id="expect-ct",
            values=[
                BaseGroupingComponent(id="salt", values=["expect-ct"]),
                BaseGroupingComponent(id="hostname", values=[interface.hostname]),
            ],
        )
    }


@strategy(ids=["expect-staple:v1"], interface=ExpectStaple, score=1001)
@produces_variants(["default"])
def expect_staple_v1(
    interface: ExpectStaple, event: Event, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    return {
        context["variant"]: BaseGroupingComponent(
            id="expect-staple",
            values=[
                BaseGroupingComponent(id="salt", values=["expect-staple"]),
                BaseGroupingComponent(id="hostname", values=[interface.hostname]),
            ],
        )
    }


@strategy(ids=["hpkp:v1"], interface=Hpkp, score=1002)
@produces_variants(["default"])
def hpkp_v1(
    interface: Hpkp, event: Event, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    return {
        context["variant"]: BaseGroupingComponent(
            id="hpkp",
            values=[
                BaseGroupingComponent(id="salt", values=["hpkp"]),
                BaseGroupingComponent(id="hostname", values=[interface.hostname]),
            ],
        )
    }


@strategy(ids=["csp:v1"], interface=Csp, score=1003)
@produces_variants(["default"])
def csp_v1(interface: Csp, event: Event, context: GroupingContext, **meta: Any) -> ReturnedVariants:
    violation_component = BaseGroupingComponent(id="violation")
    uri_component = BaseGroupingComponent(id="uri")

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
        context["variant"]: BaseGroupingComponent(
            id="csp",
            values=[
                BaseGroupingComponent(id="salt", values=[interface.effective_directive]),
                violation_component,
                uri_component,
            ],
        )
    }
