from typing import Any
from uuid import uuid4

import sentry_sdk
from django.conf import settings
from redis.exceptions import RedisError

from sentry.utils import redis
from sentry.utils.json import dumps, loads

EXPIRATION_TTL = 10 * 60

_SET_STATE_FIELD_LUA = """
local current = redis.call('GET', KEYS[1])
if not current then
    return 0
end

local state = cjson.decode(current)
state[ARGV[1]] = cjson.decode(ARGV[2])

local ttl = tonumber(ARGV[3]) or 0
if ttl > 0 then
    redis.call('SETEX', KEYS[1], ttl, cjson.encode(state))
else
    redis.call('SET', KEYS[1], cjson.encode(state))
end

return 1
"""


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

    NOTE: This object stores the state in a single redis key. Updates are applied atomically to
    avoid clobbering other in-flight changes, but callers should still prefer coarse-grained writes
    when practical.

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
    """

    redis_namespace = "session-cache"
    _supports_atomic_update = True

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
        self.mark_session()

        value = dumps(initial_state)
        self._client.setex(redis_key, self.ttl, value)

    def clear(self):
        if not self.redis_key:
            return

        self._client.delete(self.redis_key)

        session = self.request.session
        del session[self.session_key]
        self.mark_session()

    def is_valid(self):
        return bool(self.redis_key and self.get_state() is not None)

    def get_state(self):
        if not self.redis_key:
            return None

        state_json = self._client.get(self.redis_key)
        if not state_json:
            return None

        try:
            return loads(state_json)
        except Exception as e:
            sentry_sdk.capture_exception(e)
        return None

    def _set_state_value(self, field: str, value: Any) -> None:
        redis_key = self.redis_key
        if not redis_key:
            return

        ttl = str(self.ttl or 0)
        encoded_value = dumps(value)

        if type(self)._supports_atomic_update:
            try:
                updated = self._client.eval(
                    _SET_STATE_FIELD_LUA,
                    1,
                    redis_key,
                    field,
                    encoded_value,
                    ttl,
                )
            except RedisError:
                type(self)._supports_atomic_update = False
            else:
                if updated:
                    return
                # If the key no longer exists we can exit early just like the legacy behavior.
                return

        state = self.get_state()
        if state is None:
            return

        state[field] = value
        self._client.setex(redis_key, self.ttl, dumps(state))


def redis_property(key: str):
    """Declare a property backed by Redis on a RedisSessionStore class."""

    def getter(store: "RedisSessionStore"):
        state = store.get_state()

        try:
            return state[key] if state else None
        except KeyError as e:
            raise AttributeError(e)

    def setter(store: "RedisSessionStore", value):
        store._set_state_value(key, value)

    return property(getter, setter)
