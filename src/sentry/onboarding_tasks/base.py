from sentry.models.organizationonboardingtask import AbstractOnboardingTask
from sentry.utils.services import Service


class OnboardingTaskBackend(Service):
    __all__ = (
        "TASK_LOOKUP_BY_KEY",
        "STATUS_LOOKUP_BY_KEY",
        "SKIPPABLE_TASKS",
        "fetch_onboarding_tasks",
        "create_or_update_onboarding_task",
    )
    MODEL: AbstractOnboardingTask = AbstractOnboardingTask

    @property
    def TASK_LOOKUP_BY_KEY(self):
        return self.MODEL.TASK_LOOKUP_BY_KEY

    @property
    def STATUS_LOOKUP_BY_KEY(self):
        return self.MODEL.STATUS_LOOKUP_BY_KEY

    @property
    def SKIPPABLE_TASKS(self):
        return self.MODEL.SKIPPABLE_TASKS

    def fetch_onboarding_tasks(self, organization, user):
        raise NotImplementedError

    def create_or_update_onboarding_task(self, organization, user, task, values):
        raise NotImplementedError
