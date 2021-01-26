import six

from sentry.mediators import Mediator, Param
from sentry.models import PlatformExternalIssue


class Creator(Mediator):
    sentry_app = Param("sentry.models.SentryApp")
    group = Param("sentry.models.Group")
    display_name = Param(six.string_types)
    identifier = Param(six.string_types)
    web_url = Param(six.string_types)

    def call(self):
        self._create_external_issue()
        return self.external_issue

    def _format_response_data(self):
        web_url = self.response["webUrl"]

        display_name = "{}#{}".format(
            escape(self.response["project"]), escape(self.response["identifier"])
        )

        return [web_url, display_name]

    def _create_external_issue(self):
        web_url, display_name = self._format_response_data()

        self.external_issue = PlatformExternalIssue.objects.create(
            group_id=self.group.id,
            project_id=self.group.project_id,
            service_type=self.sentry_app.slug,
            display_name=self.display_name,
            web_url=self.web_url,
        )
