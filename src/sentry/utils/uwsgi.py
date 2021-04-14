import os


def reload_on_change(path):
    """
    Set up uwsgi file monitoring hooks for reloading on change
    """
    # no-op if we're not configured to do any autoreloading
    if "UWSGI_PY_AUTORELOAD" not in os.environ:
        return
    try:
        import uwsgi
        from uwsgidecorators import filemon as filemon_
    except ImportError:
        # We may not be running within a uwsgi context, so just ignore.
        return
    # Register hook with uwsgi's filemon to reload ourself on change
    filemon_(path)(uwsgi.reload)
