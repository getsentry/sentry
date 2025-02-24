from __future__ import annotations

import base64
import hmac
import logging
from hashlib import sha256

from django.http import HttpRequest, HttpResponse

from sentry.api.endpoints.release_deploys import DeploySerializer, create_deploy
from sentry.auth.services.auth.model import AuthenticatedToken
from sentry.integrations.base import FeatureDescription, IntegrationFeatures
from sentry.models.apikey import ApiKey
from sentry.models.options.project_option import ProjectOption
from sentry.models.repository import Repository
from sentry.plugins.bases.releasetracking import ReleaseTrackingPlugin
from sentry.plugins.interfaces.releasehook import ReleaseHook
from sentry.users.services.user.service import user_service
from sentry.utils import json
from sentry_plugins.base import CorePluginMixin
from sentry_plugins.utils import get_secret_field_config

logger = logging.getLogger("sentry.plugins.heroku")


class HerokuReleaseHook(ReleaseHook):
    def get_auth(self) -> AuthenticatedToken | None:
        try:
            return AuthenticatedToken.from_token(
                ApiKey(organization_id=self.project.organization_id, scope_list=["project:write"])
            )
        except ApiKey.DoesNotExist:
            return None

    def is_valid_signature(self, body, heroku_hmac):
        secret = ProjectOption.objects.get_value(project=self.project, key="heroku:webhook_secret")
        if secret is None:
            return False
        computed_hmac = base64.b64encode(
            hmac.new(
                key=secret.encode("utf-8"),
                msg=body.encode("utf-8"),
                digestmod=sha256,
            ).digest()
        ).decode("utf-8")

        return hmac.compare_digest(heroku_hmac, computed_hmac)

    def handle(self, request: HttpRequest) -> HttpResponse | None:
        heroku_hmac = request.headers.get("Heroku-Webhook-Hmac-SHA256")

        if not self.is_valid_signature(request.body.decode("utf-8"), heroku_hmac):
            logger.info("heroku.webhook.invalid-signature", extra={"project_id": self.project.id})
            return HttpResponse(status=401)

        body = json.loads(request.body)
        data = body.get("data")
        email = data.get("user", {}).get("email") or data.get("actor", {}).get("email")

        users = user_service.get_many_by_email(
            emails=[email],
            organization_id=self.project.organization_id,
            is_verified=False,
        )
        user = users[0] if users else None
        if user is None:
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

        return None

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
        serializer = DeploySerializer(
            data={"environment": deploy_project_option},
            context={"organization": self.project.organization},
        )
        assert serializer.is_valid()
        create_deploy(self.project.organization, release, serializer)


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

    def can_enable_for_projects(self):
        return True

    def can_configure_for_project(self, project):
        return True

    def has_project_conf(self):
        return True

    def get_conf_key(self):
        return "heroku"

    def get_config(self, project, user=None, initial=None, add_additional_fields: bool = False):
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

    def get_release_hook(self) -> type[HerokuReleaseHook]:
        return HerokuReleaseHook
