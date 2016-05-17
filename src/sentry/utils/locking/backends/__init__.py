class LockBackend(object):
    def acquire(self, key, duration, routing_key=None):
        raise NotImplementedError

    def release(self, key, routing_key=None):
        raise NotImplementedError
