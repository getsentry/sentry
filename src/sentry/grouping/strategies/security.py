from __future__ import annotations

from typing import TYPE_CHECKING, Any, int

from sentry.grouping.component import (
    CSPGroupingComponent,
    ExpectCTGroupingComponent,
    ExpectStapleGroupingComponent,
    HostnameGroupingComponent,
    HPKPGroupingComponent,
    SaltGroupingComponent,
    URIGroupingComponent,
    ViolationGroupingComponent,
)
from sentry.grouping.strategies.base import (
    ComponentsByVariant,
    GroupingContext,
    produces_variants,
    strategy,
)
from sentry.interfaces.security import Csp, ExpectCT, ExpectStaple, Hpkp

if TYPE_CHECKING:
    from sentry.services.eventstore.models import Event


@strategy(ids=["expect-ct:v1"], interface=ExpectCT, score=1000)
@produces_variants(["default"])
def expect_ct_v1(
    interface: ExpectCT, event: Event, context: GroupingContext, **kwargs: Any
) -> ComponentsByVariant:
    variant_name = context["variant_name"]

    return {
        variant_name: ExpectCTGroupingComponent(
            values=[
                SaltGroupingComponent(values=["expect-ct"]),
                HostnameGroupingComponent(values=[interface.hostname]),
            ],
        )
    }


@strategy(ids=["expect-staple:v1"], interface=ExpectStaple, score=1001)
@produces_variants(["default"])
def expect_staple_v1(
    interface: ExpectStaple, event: Event, context: GroupingContext, **kwargs: Any
) -> ComponentsByVariant:
    variant_name = context["variant_name"]

    return {
        variant_name: ExpectStapleGroupingComponent(
            values=[
                SaltGroupingComponent(values=["expect-staple"]),
                HostnameGroupingComponent(values=[interface.hostname]),
            ],
        )
    }


@strategy(ids=["hpkp:v1"], interface=Hpkp, score=1002)
@produces_variants(["default"])
def hpkp_v1(
    interface: Hpkp, event: Event, context: GroupingContext, **kwargs: Any
) -> ComponentsByVariant:
    variant_name = context["variant_name"]

    return {
        variant_name: HPKPGroupingComponent(
            values=[
                SaltGroupingComponent(values=["hpkp"]),
                HostnameGroupingComponent(values=[interface.hostname]),
            ],
        )
    }


@strategy(ids=["csp:v1"], interface=Csp, score=1003)
@produces_variants(["default"])
def csp_v1(
    interface: Csp, event: Event, context: GroupingContext, **kwargs: Any
) -> ComponentsByVariant:
    variant_name = context["variant_name"]

    violation_component = ViolationGroupingComponent()
    uri_component = URIGroupingComponent()

    if interface.local_script_violation_type:
        violation_component.update(values=["'%s'" % interface.local_script_violation_type])
        uri_component.update(
            contributes=False,
            hint="ignored because violation takes precedence",
            values=[interface.normalized_blocked_uri],
        )
    else:
        violation_component.update(
            contributes=False, hint="ignored because it's not a local script violation"
        )
        uri_component.update(values=[interface.normalized_blocked_uri])

    return {
        variant_name: CSPGroupingComponent(
            values=[
                SaltGroupingComponent(values=[interface.effective_directive]),
                violation_component,
                uri_component,
            ],
        )
    }
