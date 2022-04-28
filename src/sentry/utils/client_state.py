from django.conf import settings

from sentry.utils import json, redis

STATE_CATEGORIES = {
    "onboarding": {
        "ttl": 30 * 24 * 60 * 60,  # the time in seconds that the state will be persisted
        "scope": "org",  # Can be "org" or "member"
        "max_payload_size": 1024,
    }
}


def get_redis_client():
    cluster_key = getattr(settings, "SENTRY_CLIENT_STATE_REDIS_CLUSTER", "default")
    return redis.redis_clusters.get(cluster_key)


def get_client_state_key(organization, category, user):
    if category not in STATE_CATEGORIES:
        return None
    scope = STATE_CATEGORIES[category]["scope"]
    if scope == "member":
        return f"client-state:{category}:{organization}:{user.id}"
    elif scope == "org":
        return f"client-state:{category}:{organization}"
    return None


def get_client_state(category, organization, user, client=None):
    key = get_client_state_key(organization, category, user)
    if not key:
        return None
    if not client:
        client = get_redis_client()
    value = client.get(key)
    if not value:
        return None
    return json.loads(value)


def get_client_state_redirect_uri(organization_slug, fallback_url):
    if organization_slug:
        state = get_client_state("onboarding", organization_slug, None)
        if (
            state
            and state.get("state") != "finished"
            and state.get("state") != "skipped"
            and state.get("url")
        ):
            return f'/onboarding/{organization_slug}/{state["url"]}'
    return fallback_url
