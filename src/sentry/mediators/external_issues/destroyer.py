from __future__ import absolute_import

from sentry.mediators import Mediator, Param


class Destroyer(Mediator):
    external_issue = Param("sentry.models.PlatformExternalIssue")

    def call(self):
        self._delete_external_issue()
        self._notify_sentry_app()
        return True

    def _delete_external_issue(self):
        self.external_issue.delete()

    def _notify_sentry_app(self):
        """
        Placeholder until implemented. Planned but not prioritized yet.
        """
