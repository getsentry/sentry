import threading
import weakref


class ThreadCollector:
    def __init__(self):
        self.collections = weakref.WeakKeyDictionary()

    def enable(self, thread=None):
        if thread is None:
            thread = threading.current_thread()
        self.collections[thread] = []
        return self.collections[thread]

    def disable(self, thread=None):
        if thread is None:
            thread = threading.current_thread()
        try:
            del self.collections[thread]
        except KeyError:
            pass

    def get(self, thread=None):
        if thread is None:
            thread = threading.current_thread()
        return self.collections[thread]

    def append(self, item, thread=None):
        if thread is None:
            thread = threading.current_thread()
        # fail silently if not active for thread
        if thread not in self.collections:
            return
        self.collections[thread].append(item)
