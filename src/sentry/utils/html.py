try:
    from html import escape  # NOQA
except ImportError:
    from cgi import escape as _escape  # NOQA

    def escape(value):
        return _escape(value, True)
