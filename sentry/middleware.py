import warnings

__all__ = ('DBLogMiddleware',)

class DBLogMiddleware(object):
    """We now use signals"""
    def process_exception(self, request, exception):
        warnings.warn("DBLogMiddleware is no longer used.", DeprecationWarning)
