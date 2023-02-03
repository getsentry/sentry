from typing import TYPE_CHECKING

from django.conf import settings

from sentry.onboarding_tasks.base import OnboardingTaskBackend
from sentry.utils.services import LazyServiceWrapper

backend = LazyServiceWrapper(
    OnboardingTaskBackend, settings.SENTRY_ORGANIZATION_ONBOARDING_TASK, {}
)
backend.expose(locals())

if TYPE_CHECKING:
    __onboarding_task_backend = OnboardingTaskBackend()
    TASK_LOOKUP_BY_KEY = __onboarding_task_backend.TASK_LOOKUP_BY_KEY
    STATUS_LOOKUP_BY_KEY = __onboarding_task_backend.STATUS_LOOKUP_BY_KEY
    SKIPPABLE_TASKS = __onboarding_task_backend.SKIPPABLE_TASKS
    fetch_onboarding_tasks = __onboarding_task_backend.fetch_onboarding_tasks
    create_or_update_onboarding_task = __onboarding_task_backend.create_or_update_onboarding_task
