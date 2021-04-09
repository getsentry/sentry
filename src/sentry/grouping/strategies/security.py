from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.base import produces_variants, strategy


def _security_v1(reported_id, obj, context, **meta):
    return {
        context["variant"]: GroupingComponent(
            id=reported_id,
            values=[
                GroupingComponent(id="salt", values=[reported_id]),
                GroupingComponent(id="hostname", values=[obj.hostname]),
            ],
        )
    }


@strategy(id="expect-ct:v1", interfaces=["expectct"], score=1000)
@produces_variants(["default"])
def expect_ct_v1(expectct_interface, **meta):
    return _security_v1("expect-ct", expectct_interface, **meta)


@strategy(id="expect-staple:v1", interfaces=["expectstaple"], score=1001)
@produces_variants(["default"])
def expect_staple_v1(expectstaple_interface, **meta):
    return _security_v1("expect-staple", expectstaple_interface, **meta)


@strategy(id="hpkp:v1", interfaces=["hpkp"], score=1002)
@produces_variants(["default"])
def hpkp_v1(hpkp_interface, **meta):
    return _security_v1("hpkp", hpkp_interface, **meta)


@strategy(id="csp:v1", interfaces=["csp"], score=1003)
@produces_variants(["default"])
def csp_v1(csp_interface, context, **meta):
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

    return {
        context["variant"]: GroupingComponent(
            id="csp",
            values=[
                GroupingComponent(id="salt", values=[csp_interface.effective_directive]),
                violation_component,
                uri_component,
            ],
        )
    }
