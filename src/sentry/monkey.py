from __future__ import absolute_import


def register_scheme(name):
    try:
        import urlparse  # NOQA
    except ImportError:
        from urllib import parse as urlparse  # NOQA
    uses = urlparse.uses_netloc, urlparse.uses_query, urlparse.uses_relative, urlparse.uses_fragment
    for use in uses:
        if name not in use:
            use.append(name)


register_scheme('app')
register_scheme('chrome-extension')


# Intentionally strip all GET/POST/COOKIE values out of repr() for HttpRequest
# and subclass WSGIRequest. This prevents sensitive information from getting
# logged. This was yanked out of Django master anyhow.
# https://code.djangoproject.com/ticket/12098
def safe_httprequest_repr(self):
    return '<%s: %s %r>' % (self.__class__.__name__, self.method, self.get_full_path())


try:
    from django.http import HttpRequest
except ImportError:
    # This module is potentially imported before Django is installed
    # during a setup.py run
    pass
else:
    HttpRequest.__repr__ = safe_httprequest_repr
