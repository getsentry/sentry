from typing import TYPE_CHECKING, Any

from django.conf import settings

from sentry.onboarding_tasks.base import OnboardingTaskBackend
from sentry.utils.services import LazyServiceWrapper

backend = LazyServiceWrapper(
    OnboardingTaskBackend, settings.SENTRY_ORGANIZATION_ONBOARDING_TASK, {}
)
backend.expose(locals())

if TYPE_CHECKING:
    __onboarding_task_backend = OnboardingTaskBackend[Any]()
    get_task_lookup_by_key = __onboarding_task_backend.get_task_lookup_by_key
    get_status_lookup_by_key = __onboarding_task_backend.get_status_lookup_by_key
    get_skippable_tasks = __onboarding_task_backend.get_skippable_tasks
    fetch_onboarding_tasks = __onboarding_task_backend.fetch_onboarding_tasks
    create_or_update_onboarding_task = __onboarding_task_backend.create_or_update_onboarding_task
    try_mark_onboarding_complete = __onboarding_task_backend.try_mark_onboarding_complete
