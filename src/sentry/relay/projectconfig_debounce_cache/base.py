from sentry.utils.services import Service


class ProjectConfigDebounceCache(Service):
    """A cache for debouncing updates for the relay projectconfig cache.

    Whenever a project or organization option changes, we schedule a celery
    task that updates the relay configuration in the projectconfig cache.
    However, at the same time we want to debounce this task in case multiple
    option updates have been scheduled at the same time.

    This cache is allowed to randomly lose data but `mark_task_done` should be
    visible immediately, everywhere, consistently. Memcached is probably not
    going to cut it.

    The constructor takes an optional ``key_prefix`` option, which can be used to create
    multiple instances of this debounce cache with different keys.
    """

    __all__ = ("is_debounced", "debounce", "mark_task_done")

    def __init__(self, **options):
        pass

    def is_debounced(self, *, public_key, project_id, organization_id):
        """Checks if the given project/organization should be debounced.

        If this is called this with multiple arguments each scope is checked, so that even
        if you only need to check a single key an org-level debounce will be respected.  You
        must make sure that the several arguments relate to each other.
        """
        return False

    def debounce(self, *, public_key, project_id, organization_id):
        """Debounces the given project/organization, without performing any checks.

        The highest-scoped argument passed in will be debounced.
        """

    def mark_task_done(self, *, public_key, project_id, organization_id):
        """
        Mark a task done such that `is_debounced` starts emitting False
        for the given parameters.

        Returns 1 if the task was removed, 0 if it wasn't.
        """
        return 1
