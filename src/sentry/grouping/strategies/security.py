from __future__ import absolute_import

from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.base import strategy


def _security_v1(reported_id, obj):
    return GroupingComponent(
        id=reported_id,
        values=[
            GroupingComponent(id="salt", values=[reported_id]),
            GroupingComponent(id="hostname", values=[obj.hostname]),
        ],
    )


@strategy(id="expect-ct:v1", interfaces=["expectct"], variants=["default"], score=1000)
def expect_ct_v1(expectct_interface, **meta):
    return _security_v1("expect-ct", expectct_interface)


@strategy(id="expect-staple:v1", interfaces=["expectstaple"], variants=["default"], score=1001)
def expect_staple_v1(expectstaple_interface, **meta):
    return _security_v1("expect-staple", expectstaple_interface)


@strategy(id="hpkp:v1", interfaces=["hpkp"], variants=["default"], score=1002)
def hpkp_v1(hpkp_interface, **meta):
    return _security_v1("hpkp", hpkp_interface)


@strategy(id="csp:v1", interfaces=["csp"], variants=["default"], score=1003)
def csp_v1(csp_interface, **meta):
    violation_component = GroupingComponent(id="violation")
    uri_component = GroupingComponent(id="uri")

    if csp_interface.local_script_violation_type:
        violation_component.update(values=["'%s'" % csp_interface.local_script_violation_type])
        uri_component.update(
            contributes=False,
            hint="violation takes precedence",
            values=[csp_interface.normalized_blocked_uri],
        )
    else:
        violation_component.update(contributes=False, hint="not a local script violation")
        uri_component.update(values=[csp_interface.normalized_blocked_uri])

    return GroupingComponent(
        id="csp",
        values=[
            GroupingComponent(id="salt", values=[csp_interface.effective_directive]),
            violation_component,
            uri_component,
        ],
    )
