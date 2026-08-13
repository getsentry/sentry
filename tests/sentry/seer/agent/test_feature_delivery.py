from sentry.seer.agent.feature_delivery import DELIVERY_HANDLERS
from sentry.seer.autofix_rca.delivery import deliver_autofix_rca_result


def test_autofix_delivery_routes_under_current_and_legacy_feature_ids() -> None:
    # Runs started before the autofix_rca -> autofix rename still deliver the old
    # id from persisted state until they drain.
    assert DELIVERY_HANDLERS["autofix"] is deliver_autofix_rca_result
    assert DELIVERY_HANDLERS["autofix_rca"] is deliver_autofix_rca_result
