from __future__ import absolute_import, print_function

from uuid import uuid4

from sentry.utils.redis import clusters
from sentry.utils.json import dumps, loads

EXPIRATION_TTL = 10 * 60


class RedisSessionStore(object):
    """
    RedisSessionStore provides a convenience object, which when initalized will
    store attributes assigned to it into redis. The redis key is stored into
    the request session. Useful for storing data too large to be stored into
    the session cookie.

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
    """

    def __init__(self, request, prefix, ttl=EXPIRATION_TTL):
        self.__dict__["request"] = request
        self.__dict__["prefix"] = prefix
        self.__dict__["ttl"] = ttl

    @property
    def _client(self):
        return clusters.get("default").get_local_client_for_key(self.redis_key)

    @property
    def session_key(self):
        return u"store:{}".format(self.prefix)

    @property
    def redis_key(self):
        return self.request.session.get(self.session_key)

    def regenerate(self, initial_state=None):
        if initial_state is None:
            initial_state = {}

        redis_key = u"session-cache:{}:{}".format(self.prefix, uuid4().hex)

        self.request.session[self.session_key] = redis_key

        value = dumps(initial_state)
        self._client.setex(redis_key, self.ttl, value)

    def clear(self):
        if not self.redis_key:
            return

        self._client.delete(self.redis_key)
        del self.request.session[self.session_key]

    def is_valid(self):
        return self.redis_key and self._client.get(self.redis_key)

    def get_state(self):
        if not self.redis_key:
            return None

        state_json = self._client.get(self.redis_key)
        if not state_json:
            return None

        return loads(state_json)

    def __getattr__(self, key):
        state = self.get_state()

        try:
            return state[key] if state else None
        except KeyError as e:
            raise AttributeError(e)

    def __setattr__(self, key, value):
        state = self.get_state()

        if state is None:
            return

        state[key] = value
        self._client.setex(self.redis_key, self.ttl, dumps(state))
