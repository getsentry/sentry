from __future__ import absolute_import

from sentry.celery import app
from sentry.web.frontend.base import BaseView


class AdminQueueView(BaseView):
    def has_permission(self, request):
        return request.is_superuser()

    def handle(self, request):
        context = {
            'task_list': sorted(app.tasks.keys()),
        }

        return self.respond('sentry/admin-queue.html', context)
