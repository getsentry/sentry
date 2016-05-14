class LockBackend(object):
    def acquire(self, key, duration):
        raise NotImplementedError

    def release(self, key):
        raise NotImplementedError
