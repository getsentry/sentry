__all__ = ["StatsdMetricsBackend"]

import statsd

from .base import MetricsBackend


class PatchedStatsClient(statsd.StatsClient):
    """The Python statsd client has a bug in the latest release version where it's
    impossible to close the socket.  This is a patched version of the client that
    fixes this issue.
    """

    if not hasattr(statsd.StatsClient, "close"):

        def close(self):
            sock = getattr(self, "_sock", None)
            if sock and hasattr(sock, "close"):
                sock.close()
            self._sock = None


class StatsdMetricsBackend(MetricsBackend):
    def __init__(self, host="127.0.0.1", port=8125, **kwargs):
        self.client = PatchedStatsClient(host=host, port=port)
        super().__init__(**kwargs)

    def __del__(self):
        # be explicit here to avoid the resource warning.
        self.client.close()

    def _full_key(self, key, instance=None):
        if instance:
            return f"{key}.{instance}"
        return key

    def incr(self, key, instance=None, tags=None, amount=1, sample_rate=1):
        self.client.incr(self._full_key(self._get_key(key)), amount, sample_rate)

    def timing(self, key, value, instance=None, tags=None, sample_rate=1):
        self.client.timing(self._full_key(self._get_key(key)), value, sample_rate)

    def gauge(self, key, value, instance=None, tags=None, sample_rate=1):
        self.client.gauge(self._full_key(self._get_key(key)), value, sample_rate)
