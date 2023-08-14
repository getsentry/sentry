from .pickle import patch_pickle_loaders


def register_scheme(name):
    from urllib import parse as urlparse

    uses = urlparse.uses_netloc, urlparse.uses_query, urlparse.uses_relative, urlparse.uses_fragment
    for use in uses:
        if name not in use:
            use.append(name)


register_scheme("app")
register_scheme("chrome-extension")


def patch_celery_imgcat():
    # Remove Celery's attempt to display an rgb image in iTerm 2, as that
    # attempt just prints out base64 trash in tmux.
    try:
        from celery.utils import term
    except ImportError:
        return

    term.imgcat = lambda *a, **kw: b""


def patch_memcached():
    # Fixes a bug in Django 3.2
    try:
        from django.core.cache.backends.memcached import MemcachedCache
    except ImportError:
        return

    def fixed_delete(self, key, version=None):
        key = self.make_key(key, version=version)
        self.validate_key(key)
        return bool(self._cache.delete(key))

    MemcachedCache.delete = fixed_delete  # type: ignore[method-assign]


patch_celery_imgcat()
patch_pickle_loaders()
patch_memcached()
