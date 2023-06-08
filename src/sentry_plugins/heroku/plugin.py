import base64
import hmac
import logging
from hashlib import sha256

from django.http import HttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.integrations import FeatureDescription, IntegrationFeatures
from sentry.models import ApiKey, ProjectOption, Repository, User
from sentry.plugins.base.configuration import react_plugin_config
from sentry.plugins.bases import ReleaseTrackingPlugin
from sentry.plugins.interfaces.releasehook import ReleaseHook
from sentry.utils import json
from sentry_plugins.base import CorePluginMixin
from sentry_plugins.utils import get_secret_field_config

from .client import HerokuApiClient

logger = logging.getLogger("sentry.plugins.heroku")


class HerokuReleaseHook(ReleaseHook):
    def get_auth(self):
        try:
            return ApiKey(
                organization_id=self.project.organization_id, scope_list=["project:write"]
            )
        except ApiKey.DoesNotExist:
            return None

    def get_client(self):
        return HerokuApiClient()

    def is_valid_signature(self, body, heroku_hmac):
        secret = ProjectOption.objects.get_value(project=self.project, key="heroku:webhook_secret")
        computed_hmac = base64.b64encode(
            hmac.new(
                key=secret.encode("utf-8"),
                msg=body.encode("utf-8"),
                digestmod=sha256,
            ).digest()
        ).decode("utf-8")

        return hmac.compare_digest(heroku_hmac, computed_hmac)

    def handle(self, request: Request) -> Response:
        heroku_hmac = request.headers.get("Heroku-Webhook-Hmac-SHA256")

        if not self.is_valid_signature(request.body.decode("utf-8"), heroku_hmac):
            logger.info("heroku.webhook.invalid-signature", extra={"project_id": self.project.id})
            return HttpResponse(status=401)

        body = json.loads(request.body)
        data = body.get("data")
        email = data.get("user", {}).get("email") or data.get("actor", {}).get("email")

        try:
            user = User.objects.get(
                email__iexact=email, sentry_orgmember_set__organization__project=self.project
            )
        except (User.DoesNotExist, User.MultipleObjectsReturned):
            user = None
            logger.info(
                "owner.missing",
                extra={
                    "organization_id": self.project.organization_id,
                    "project_id": self.project.id,
                    "email": email,
                },
            )
        slug = data.get("slug")
        if not slug:
            logger.info("heroku.payload.missing-commit", extra={"project_id": self.project.id})
            return HttpResponse(status=401)

        commit = slug.get("commit")
        app_name = data.get("app", {}).get("name")
        if body.get("action") == "update":
            if app_name:
                self.finish_release(
                    version=commit,
                    url=f"http://{app_name}.herokuapp.com",
                    owner_id=user.id if user else None,
                )
            else:
                self.finish_release(version=commit, owner_id=user.id if user else None)

    def set_refs(self, release, **values):
        if not values.get("owner_id", None):
            return
        # check if user exists, and then try to get refs based on version
        repo_project_option = ProjectOption.objects.get_value(
            project=self.project, key="heroku:repository"
        )
        deploy_project_option = (
            ProjectOption.objects.get_value(
                project=self.project, key="heroku:environment", default="production"
            )
            or "production"
        )
        if repo_project_option:
            try:
                repository = Repository.objects.get(
                    organization_id=self.project.organization_id, name=repo_project_option
                )
            except Repository.DoesNotExist:
                logger.info(
                    "repository.missing",
                    extra={
                        "organization_id": self.project.organization_id,
                        "project_id": self.project.id,
                        "repository": repo_project_option,
                    },
                )
            else:
                release.set_refs(
                    refs=[{"commit": release.version, "repository": repository.name}],
                    user_id=values["owner_id"],
                    fetch=True,
                )
        # create deploy associated with release via ReleaseDeploysEndpoint
        endpoint = (
            f"/organizations/{self.project.organization.slug}/releases/{release.version}/deploys/"
        )
        client = self.get_client()
        client.post(endpoint, data={"environment": deploy_project_option}, auth=self.get_auth())


class HerokuPlugin(CorePluginMixin, ReleaseTrackingPlugin):
    author = "Sentry Team"
    author_url = "https://github.com/getsentry"
    title = "Heroku"
    slug = "heroku"
    description = "Integrate Heroku release tracking."
    required_field = "repository"
    feature_descriptions = [
        FeatureDescription(
            """
            Integrate Heroku release tracking.
            """,
            IntegrationFeatures.DEPLOYMENT,
        )
    ]

    def configure(self, project, request):
        return react_plugin_config(self, project, request)

    def can_enable_for_projects(self):
        return True

    def can_configure_for_project(self, project):
        return True

    def has_project_conf(self):
        return True

    def get_conf_key(self):
        return "heroku"

    def get_config(self, project, **kwargs):
        repo_list = list(Repository.objects.filter(organization_id=project.organization_id))
        if not ProjectOption.objects.get_value(project=project, key="heroku:repository"):
            choices = [("", "select a repo")]
        else:
            choices = []
        choices.extend([(repo.name, repo.name) for repo in repo_list])

        webhook_secret = self.get_option("webhook_secret", project)
        secret_field = get_secret_field_config(
            webhook_secret,
            "Enter the webhook signing secret shown after running the Heroku CLI command.",
        )
        secret_field.update(
            {
                "name": "webhook_secret",
                "label": "Webhook Secret",
                "required": False,
            }
        )

        return [
            {
                "name": "repository",
                "label": "Respository",
                "type": "select",
                "required": True,
                "choices": choices,
                "help": "Select which repository you would like to be associated with this project",
            },
            {
                "name": "environment",
                "label": "Deploy Environment",
                "type": "text",
                "required": False,
                "default": "production",
                "help": "Specify an environment name for your Heroku deploys",
            },
            secret_field,
        ]

    def get_release_doc_html(self, hook_url):
        return f"""
        <p>Add a Sentry release webhook to automatically track new releases.</p>
        <pre class="clippy">heroku webhooks:add -i api:release -l notify -u {hook_url} -a YOUR_APP_NAME</pre>
        """

    def get_release_hook(self):
        return HerokuReleaseHook
