from abc import ABCMeta, abstractmethod


class AbstractIndexBackend(metaclass=ABCMeta):
    @abstractmethod
    def classify(self, scope, items, limit=None, timestamp=None):
        pass

    @abstractmethod
    def compare(self, scope, key, items, limit=None, timestamp=None):
        pass

    @abstractmethod
    def record(self, scope, key, items, timestamp=None):
        pass

    @abstractmethod
    def merge(self, scope, destination, items, timestamp=None):
        pass

    @abstractmethod
    def delete(self, scope, items, timestamp=None):
        pass

    @abstractmethod
    def scan(self, scope, indices, batch=1000, timestamp=None):
        pass

    @abstractmethod
    def flush(self, scope, indices, batch=1000, timestamp=None):
        pass

    @abstractmethod
    def export(self, scope, items, timestamp=None):
        pass

    @abstractmethod
    def import_(self, scope, items, timestamp=None):
        pass
