from sentry.models.organizationonboardingtask import AbstractOnboardingTask
from sentry.utils.services import Service


class OnboardingTaskBackend(Service):
    __all__ = (
        "get_task_lookup_by_key",
        "get_status_lookup_by_key",
        "get_skippable_tasks",
        "fetch_onboarding_tasks",
        "create_or_update_onboarding_task",
        "try_mark_onboarding_complete",
    )
    Model: AbstractOnboardingTask = AbstractOnboardingTask

    def get_task_lookup_by_key(self, key):
        return self.Model.TASK_LOOKUP_BY_KEY.get(key)

    def get_status_lookup_by_key(self, key):
        return self.Model.STATUS_LOOKUP_BY_KEY.get(key)

    def get_skippable_tasks(self):
        return self.Model.SKIPPABLE_TASKS

    def fetch_onboarding_tasks(self, organization, user):
        raise NotImplementedError

    def create_or_update_onboarding_task(self, organization, user, task, values):
        raise NotImplementedError

    def try_mark_onboarding_complete(self, organization_id):
        raise NotImplementedError
