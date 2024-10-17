from sentry.utils.services import ServiceDelegator, make_writebehind_selector

backends_config = {
    "errors": {
        "path": "sentry.eventstore.processing.event_processing_store",
        "executor": {
            "path": "sentry.utils.services.ThreadedExecutor",
            "options": {
                "worker_count": 1,
            },
        },
    },
    "transactions": {
        "path": "sentry.eventstore.processing.transaction_processing_store",
        "executor": {
            "path": "sentry.utils.services.ThreadedExecutor",
            "options": {
                "worker_count": 1,
            },
        },
    },
}

selector = make_writebehind_selector(
    option_name="rc-processing-split.rollout",
    move_to="transactions",
    move_from="errors",
    key_fetch=lambda *args: "a-consistent-key",
)

eventstore_delegator = ServiceDelegator(
    backend_base="sentry.eventstore.processing.base.EventProcessingStore",
    backends=backends_config,
    selector_func=selector,
)
