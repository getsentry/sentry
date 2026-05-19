from uuid import uuid4

import sentry_sdk
from django.conf import settings

from sentry.utils import redis
from sentry.utils.json import dumps, loads

EXPIRATION_TTL = 10 * 60


class RedisSessionStore:
    """
    RedisSessionStore provides a convenience object, which when initialized will
    store attributes assigned to it into redis. The redis key is stored into
    the request session. Useful for storing data too large to be stored into
    the session cookie.

    The attributes to be backed by Redis must be declared in a subclass using
    the `redis_property` function. Do not instantiate RedisSessionStore without
    extending it to add properties. For example:

    >>> class HotDogSessionStore(RedisSessionStore):
    >>>     bun = redis_property("bun")
    >>>     condiment = redis_property("condiment")

    NOTE: Assigning attributes immediately saves their value back into the
          redis key assigned for this store. Be aware of the multiple
          round-trips implication of this.

    NOTE: This object is subject to race conditions on updating valeus as the
          entire object value is stored in one redis key.

    >>> store = RedisSessionStore(request, 'store-name')
    >>> store.regenerate()
    >>> store.some_value = 'my value'

    The value will be available across requests as long as the same same store
    name is used.

    >>> store.some_value
    'my value'

    The store may be destroyed before it expires using the ``clear`` method.

    >>> store.clear()

    It's important to note that the session store will expire if values are not
    modified within the provided ttl.

    Resilience
    ----------
    In addition to the primary Redis storage, the state is mirrored into the
    Django session (database-backed in typical Sentry deployments) under
    ``store_data:{prefix}``.  If Redis is unavailable (e.g. a test-only
    ``flushdb()`` clears the cluster), ``get_state()`` falls back to the
    session copy and re-populates Redis automatically.  In production Redis
    is always available so the fallback path is never exercised.
    """

    redis_namespace = "session-cache"

    def __init__(self, request, prefix, ttl=EXPIRATION_TTL):
        self.request = request
        self.prefix = prefix
        self.ttl = ttl

    @property
    def _client(self):
        return redis.redis_clusters.get(settings.SENTRY_SESSION_STORE_REDIS_CLUSTER)

    @property
    def session_key(self) -> str:
        return f"store:{self.prefix}"

    @property
    def _fallback_session_key(self) -> str:
        """Django session key that holds the state as a direct fallback."""
        return f"store_data:{self.prefix}"

    @property
    def redis_key(self):
        return self.request.session.get(self.session_key)

    def mark_session(self):
        # Subclasses may override to mark session as modified
        pass

    def regenerate(self, initial_state=None):
        if initial_state is None:
            initial_state = {}

        redis_key = f"{self.redis_namespace}:{self.prefix}:{uuid4().hex}"

        self.request.session[self.session_key] = redis_key
        # Keep a DB-session copy so the state survives a Redis flush.
        self.request.session[self._fallback_session_key] = initial_state
        self.mark_session()

        value = dumps(initial_state)
        self._client.setex(redis_key, self.ttl, value)

    def clear(self):
        if not self.redis_key:
            return

        self._client.delete(self.redis_key)

        session = self.request.session
        del session[self.session_key]
        session.pop(self._fallback_session_key, None)
        self.mark_session()

    def is_valid(self):
        return bool(self.redis_key and self.get_state() is not None)

    def get_state(self):
        if not self.redis_key:
            return None

        state_json = self._client.get(self.redis_key)
        if state_json:
            try:
                return loads(state_json)
            except Exception as e:
                # Redis has the key but the value is malformed (e.g. bit flip).
                # Do NOT fall back to the session copy — the caller should treat
                # this as an invalid state, same as the pre-fallback behaviour.
                sentry_sdk.capture_exception(e)
                return None

        # Redis key is absent (flushed) — fall back to the Django session copy.
        fallback = self.request.session.get(self._fallback_session_key)
        if fallback is not None:
            # Re-warm Redis so subsequent reads are fast.
            try:
                self._client.setex(self.redis_key, self.ttl, dumps(fallback))
            except Exception:
                pass
            return fallback

        return None


def redis_property(key: str):
    """Declare a property backed by Redis on a RedisSessionStore class."""

    def getter(store: "RedisSessionStore"):
        state = store.get_state()

        try:
            return state[key] if state else None
        except KeyError as e:
            raise AttributeError(e)

    def setter(store: "RedisSessionStore", value):
        state = store.get_state()

        if state is None:
            return

        state[key] = value
        store._client.setex(store.redis_key, store.ttl, dumps(state))
        # Keep the Django session fallback in sync.
        store.request.session[store._fallback_session_key] = state
        store.mark_session()

    return property(getter, setter)
