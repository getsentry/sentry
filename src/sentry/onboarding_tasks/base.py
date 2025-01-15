from __future__ import annotations

from typing import Generic, TypeVar

from django.contrib.auth.models import AnonymousUser

from sentry.models.organization import Organization
from sentry.models.organizationonboardingtask import AbstractOnboardingTask
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.services import Service

T = TypeVar("T", bound=AbstractOnboardingTask)


class OnboardingTaskBackend(Service, Generic[T]):
    __all__ = (
        "get_task_lookup_by_key",
        "get_status_lookup_by_key",
        "get_skippable_tasks",
        "fetch_onboarding_tasks",
        "create_or_update_onboarding_task",
        "try_mark_onboarding_complete",
    )
    Model: type[T]

    def get_task_lookup_by_key(self, key):
        return self.Model.TASK_LOOKUP_BY_KEY.get(key)

    def get_status_lookup_by_key(self, key):
        return self.Model.STATUS_LOOKUP_BY_KEY.get(key)

    def get_skippable_tasks(self, organization: Organization, user: User | RpcUser | AnonymousUser):
        return self.Model.SKIPPABLE_TASKS

    def fetch_onboarding_tasks(self, organization, user):
        raise NotImplementedError

    def create_or_update_onboarding_task(self, organization, user, task, values):
        raise NotImplementedError

    def try_mark_onboarding_complete(
        self, organization_id: int, user: User | RpcUser | AnonymousUser
    ):
        raise NotImplementedError
