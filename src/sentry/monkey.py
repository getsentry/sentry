from __future__ import absolute_import


def register_scheme(name):
    from six.moves.urllib import parse as urlparse
    uses = urlparse.uses_netloc, urlparse.uses_query, urlparse.uses_relative, urlparse.uses_fragment
    for use in uses:
        if name not in use:
            use.append(name)


register_scheme('app')
