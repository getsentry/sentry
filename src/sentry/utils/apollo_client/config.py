import os

from .client import ApolloClient
from .registry import ConfigRegistry


class ApolloConfig(object):
    def __init__(self, prefix):
        self._apollo = None
        self._registry = None
        self.prefix = (prefix if prefix.endswith("_") else prefix + "_").upper()

    @property
    def registry(self):
        if self._registry is None:
            self._registry = ConfigRegistry()
        return self._registry

    @registry.setter
    def registry(self, value):
        if isinstance(value, dict):
            value = ConfigRegistry(value)
        elif not isinstance(value, ConfigRegistry):
            raise ValueError("value is not ConfigRegistry")
        self._registry = value

    @property
    def apollo(self):
        if self._apollo is not None:
            return self._apollo
        client = ApolloClient.env()
        if client is None:
            raise AttributeError("apollo is not set")
        else:
            self._apollo = client
        return self._apollo

    @apollo.setter
    def apollo(self, value):
        if not isinstance(value, ApolloClient):
            raise ValueError("value is not ApolloClient")
        self._apollo = value

    def init(self, apollo=True):
        if apollo is True:
            self.apollo.pull()
            for key, val in self.apollo.setting.items():
                self.registry.set(key, val)

        for key, value in os.environ.items():
            if not key.startswith(self.prefix):
                continue
            key = key[len(self.prefix) :].lower().replace("_", ".")
            if not key:
                return False
            self.registry.set(key, value)

    def get(self, key=None, default=None, apollo=False, env=False):
        value = self.registry.get(key)
        if value is not None and apollo is True:
            try:
                tmp = self.apollo.get(key, cache=False)
                if tmp is not None:
                    value = tmp
            except:
                pass
        if value is not None and env is True:
            name = self.prefix + key.upper()
            tmp = os.environ.get(name)
            if tmp is not None:
                value = tmp
        if value is None and default is not None:
            value = default
        if isinstance(value, dict):
            value = ResultDict(value)
        return value


class ResultDict(ConfigRegistry):
    def get(self, key="", default=None, empty=False):
        key = key.replace("_", ".")
        return super().get(key, default, empty)
