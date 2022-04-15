from sentry.utils.session_store import RedisSessionStore, redis_property


class PipelineSessionStore(RedisSessionStore):  # type: ignore
    uid = redis_property("uid")
    provider_model_id = redis_property("provider_model_id")
    provider_key = redis_property("provider_key")
    org_id = redis_property("org_id")
    signature = redis_property("signature")
    step_index = redis_property("step_index")
    config = redis_property("config")
    data = redis_property("data")
