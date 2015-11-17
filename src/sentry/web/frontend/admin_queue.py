from __future__ import absolute_import

from sentry.auth.utils import is_active_superuser
from sentry.celery import app
from sentry.web.frontend.base import BaseView


class AdminQueueView(BaseView):
    def has_permission(self, request):
        return is_active_superuser(request.user)

    def handle(self, request):
        context = {
            'task_list': sorted(app.tasks.keys()),
        }

        return self.respond('sentry/admin-queue.html', context)
