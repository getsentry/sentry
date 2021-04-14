from sentry.utils.services import Service


class ProjectConfigDebounceCache(Service):
    """
    A cache for debouncing updates for the relay projectconfig cache.

    Whenever a project or organization option changes, we schedule a celery
    task that updates the relay configuration in the projectconfig cache.
    However, at the same time we want to debounce this task in case multiple
    option updates have been scheduled at the same time.

    This cache is allowed to randomly lose data but `mark_task_done` should be
    visible immediately, everywhere, consistently. Memcached is probably not
    going to cut it.
    """

    __all__ = ("check_is_debounced", "mark_task_done")

    def __init__(self, **options):
        pass

    def check_is_debounced(self, project_id, organization_id):
        """
        Check if the given project/organization should be debounced.

        It's fine to erroneously return false, it's not fine to erroneously
        return true.
        """

        return False

    def mark_task_done(self, project_id, organization_id):
        """
        Mark a task done such that `check_is_debounced` starts emitting False
        for the given parameters.
        """
