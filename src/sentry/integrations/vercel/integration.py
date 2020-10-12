from __future__ import absolute_import

from uuid import uuid4
import six
import logging

from django.utils.translation import ugettext_lazy as _
from rest_framework.serializers import ValidationError
from six.moves.urllib.parse import urlencode


from sentry.integrations import (
    IntegrationInstallation,
    IntegrationFeatures,
    IntegrationProvider,
    IntegrationMetadata,
    FeatureDescription,
)
from sentry import options
from sentry.constants import ObjectStatus
from sentry.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.utils.http import absolute_uri
from sentry.models import (
    Organization,
    Integration,
    Project,
    ProjectKey,
    User,
    SentryAppInstallation,
    SentryAppInstallationForProvider,
)
from sentry.utils.compat import map
from sentry.shared_integrations.exceptions import IntegrationError, ApiError
from sentry.mediators.sentry_apps import InternalCreator

from .client import VercelClient

logger = logging.getLogger("sentry.integrations.vercel")

DESCRIPTION = _(
    """
Vercel is an all-in-one platform with Global CDN supporting static & JAMstack deployment and Serverless Functions.
"""
)

FEATURES = [
    FeatureDescription(
        """
        Connect your Sentry and Vercel projects to automatically upload source maps and notify Sentry of new releases being deployed.
        """,
        IntegrationFeatures.DEPLOYMENT,
    )
]

INSTALL_NOTICE_TEXT = _(
    "Visit the Vercel Marketplace to install this integration. After installing the"
    " Sentry integration, you'll be redirected back to Sentry to finish syncing Vercel and Sentry projects."
)


external_install = {
    "url": u"https://vercel.com/integrations/%s/add" % options.get("vercel.integration-slug"),
    "buttonText": _("Vercel Marketplace"),
    "noticeText": _(INSTALL_NOTICE_TEXT),
}


configure_integration = {"title": _("Connect Your Projects")}
connect_project_instruction = _(
    "To complete installation, please connect your Sentry and Vercel projects."
)
install_source_code_integration = _(
    "Install a [source code integration]({}) and configure your repositories."
)

disable_dialog = {
    "actionText": _("Visit Vercel"),
    "body": _(
        "In order to uninstall this integration, you must go"
        " to Vercel and uninstall there by clicking 'Remove Configuration'."
    ),
}


metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?title=Vercel%20Integration:%20&labels=Component%3A%20Integrations",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/vercel",
    aspects={
        "externalInstall": external_install,
        "configure_integration": configure_integration,
        "disable_dialog": disable_dialog,
    },
)

internal_integration_overview = (
    "This internal integration was auto-generated during the installation process of your Vercel"
    " integration. It is needed to provide the token used to create a release. If this integration is "
    "deleted, your Vercel integration will stop working!"
)


class VercelIntegration(IntegrationInstallation):
    @property
    def metadata(self):
        return self.model.metadata

    def get_dynamic_display_information(self):
        organization = Organization.objects.get_from_cache(id=self.organization_id)
        source_code_link = absolute_uri(
            u"/settings/%s/integrations/?%s"
            % (organization.slug, urlencode({"category": "source code management"}))
        )
        return {
            "configure_integration": {
                "instructions": [
                    connect_project_instruction,
                    install_source_code_integration.format(source_code_link),
                ]
            }
        }

    def get_client(self):
        access_token = self.metadata["access_token"]
        if self.metadata["installation_type"] == "team":
            return VercelClient(access_token, self.model.external_id)

        return VercelClient(access_token)

    # note this could return a different integration if the user has multiple
    # installations with the same organization
    def get_configuration_id(self):
        for configuration_id, data in self.metadata["configurations"].items():
            if data["organization_id"] == self.organization_id:
                return configuration_id
        logger.error(
            "could not find matching org",
            extra={"organization_id": self.organization_id, "integration_id": self.model.id},
        )
        return None

    def get_slug(self):
        client = self.get_client()
        if self.metadata["installation_type"] == "team":
            team = client.get_team()
            return team["slug"]
        else:
            user = client.get_user()
            return user["username"]

    def get_organization_config(self):
        vercel_client = self.get_client()
        # TODO: add try/catch if we get API failure
        slug = self.get_slug()
        base_url = u"https://vercel.com/%s" % slug
        vercel_projects = [
            {"value": p["id"], "label": p["name"], "url": u"%s/%s" % (base_url, p["name"])}
            for p in vercel_client.get_projects()
        ]

        next_url = None
        configuration_id = self.get_configuration_id()
        if configuration_id:
            if self.metadata["installation_type"] == "team":
                dashboard_url = u"https://vercel.com/dashboard/%s/" % slug
            else:
                dashboard_url = "https://vercel.com/dashboard/"
            next_url = u"%s/integrations/%s" % (dashboard_url, configuration_id)

        proj_fields = ["id", "platform", "name", "slug"]
        sentry_projects = map(
            lambda proj: {key: proj[key] for key in proj_fields},
            (
                Project.objects.filter(
                    organization_id=self.organization_id, status=ObjectStatus.VISIBLE
                )
                .order_by("slug")
                .values(*proj_fields)
            ),
        )

        fields = [
            {
                "name": "project_mappings",
                "type": "project_mapper",
                "mappedDropdown": {
                    "items": vercel_projects,
                    "placeholder": _("Choose Vercel project..."),
                },
                "sentryProjects": sentry_projects,
                "nextButton": {"url": next_url, "text": _("Return to Vercel")},
                "iconType": "vercel",
            }
        ]

        return fields

    def update_organization_config(self, data):
        # data = {"project_mappings": [[sentry_project_id, vercel_project_id]]}
        vercel_client = self.get_client()
        config = self.org_integration.config
        try:
            new_mappings = data["project_mappings"]
        except KeyError:
            return ValidationError("Failed to update configuration.")

        old_mappings = config.get("project_mappings") or []

        for mapping in new_mappings:
            # skip any mappings that already exist
            if mapping in old_mappings:
                continue
            [sentry_project_id, vercel_project_id] = mapping
            sentry_project = Project.objects.get(id=sentry_project_id)
            enabled_dsn = ProjectKey.get_default(project=sentry_project)
            if not enabled_dsn:
                raise ValidationError(
                    {"project_mappings": ["You must have an enabled DSN to continue!"]}
                )
            source_code_provider = self.get_source_code_provider(vercel_client, vercel_project_id)
            if not source_code_provider:
                raise ValidationError(
                    {
                        "project_mappings": [
                            "You must connect your Vercel project to a Git repository to continue!"
                        ]
                    }
                )
            sentry_project_dsn = enabled_dsn.get_dsn(public=True)
            uuid = uuid4().hex

            sentry_app_installation = SentryAppInstallationForProvider.objects.get(
                organization=sentry_project.organization.id, provider="vercel"
            )
            sentry_auth_token = sentry_app_installation.get_token(
                self.organization_id, provider="vercel"
            )
            secret_names = [
                "SENTRY_ORG_%s" % uuid,
                "SENTRY_PROJECT_%s" % uuid,
                "NEXT_PUBLIC_SENTRY_DSN_%s" % uuid,
                "SENTRY_AUTH_TOKEN_%s" % uuid,
            ]
            values = [
                sentry_project.organization.slug,
                sentry_project.slug,
                sentry_project_dsn,
                sentry_auth_token,
            ]
            env_var_names = [
                "SENTRY_ORG",
                "SENTRY_PROJECT",
                "NEXT_PUBLIC_SENTRY_DSN",
                "SENTRY_AUTH_TOKEN",
                "VERCEL_%s_COMMIT_SHA" % source_code_provider.upper(),
            ]

            secrets = []
            for name, val in zip(secret_names, values):
                secrets.append(self.create_secret(vercel_client, vercel_project_id, name, val))

            secrets.append("")
            for secret, env_var in zip(secrets, env_var_names):
                self.create_env_var(vercel_client, vercel_project_id, env_var, secret)

        config.update(data)
        self.org_integration.update(config=config)

    def get_source_code_provider(self, client, vercel_project_id):
        try:
            return client.get_source_code_provider(vercel_project_id)
        except KeyError:
            return None

    def get_env_vars(self, client, vercel_project_id):
        return client.get_env_vars(vercel_project_id)

    def env_var_already_exists(self, client, vercel_project_id, name):
        return any(
            [
                env_var
                for env_var in self.get_env_vars(client, vercel_project_id)["envs"]
                if env_var["key"] == name
            ]
        )

    def create_secret(self, client, vercel_project_id, name, value):
        return client.create_secret(vercel_project_id, name, value)

    def create_env_var(self, client, vercel_project_id, key, value):
        if not self.env_var_already_exists(client, vercel_project_id, key):
            return client.create_env_variable(vercel_project_id, key, value)
        self.update_env_variable(client, vercel_project_id, key, value)

    def update_env_variable(self, client, vercel_project_id, key, value):
        return client.update_env_variable(vercel_project_id, key, value)


class VercelIntegrationProvider(IntegrationProvider):
    key = "vercel"
    name = "Vercel"
    can_add = False
    can_disable = True
    metadata = metadata
    integration_cls = VercelIntegration
    features = frozenset([IntegrationFeatures.DEPLOYMENT])
    oauth_redirect_url = "/extensions/vercel/configure/"

    def get_pipeline_views(self):
        identity_pipeline_config = {"redirect_url": absolute_uri(self.oauth_redirect_url)}

        identity_pipeline_view = NestedPipelineView(
            bind_key="identity",
            provider_key=self.key,
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [identity_pipeline_view]

    def get_configuration_metadata(self, external_id):
        # If a vercel team or user was already installed on another sentry org
        # we want to make sure we don't overwrite the existing configurations. We
        # keep all the configurations so that if one of them is deleted from vercel's
        # side, the other sentry org will still have a working vercel integration.
        try:
            integration = Integration.objects.get(external_id=external_id, provider=self.key)
        except Integration.DoesNotExist:
            # first time setting up vercel team/user
            return {}

        return integration.metadata["configurations"]

    def build_integration(self, state):
        data = state["identity"]["data"]
        access_token = data["access_token"]
        team_id = data.get("team_id")
        client = VercelClient(access_token, team_id)

        if team_id:
            external_id = team_id
            installation_type = "team"
            team = client.get_team()
            name = team["name"]
        else:
            external_id = data["user_id"]
            installation_type = "user"
            user = client.get_user()
            name = user.get("name") or user["username"]
        try:
            webhook = client.create_deploy_webhook()
        except ApiError as err:
            logger.info(
                "vercel.create_webhook.failed",
                extra={"error": six.text_type(err), "external_id": external_id},
            )
            try:
                details = list(err.json["messages"][0].values()).pop()
            except Exception:
                details = "Unknown Error"
            message = u"Could not create deployment webhook in Vercel: {}".format(details)
            raise IntegrationError(message)

        configurations = self.get_configuration_metadata(external_id)

        integration = {
            "name": name,
            "external_id": external_id,
            "metadata": {
                "access_token": access_token,
                "installation_id": data["installation_id"],
                "installation_type": installation_type,
                "webhook_id": webhook["id"],
                "configurations": configurations,
            },
            "post_install_data": {"user_id": state["user_id"]},
        }

        return integration

    def post_install(self, integration, organization, extra=None):
        # add new configuration information to metadata
        configurations = integration.metadata.get("configurations") or {}
        configurations[integration.metadata["installation_id"]] = {
            "access_token": integration.metadata["access_token"],
            "webhook_id": integration.metadata["webhook_id"],
            "organization_id": organization.id,
        }
        integration.metadata["configurations"] = configurations
        integration.save()

        # check if we have an installation already
        if SentryAppInstallationForProvider.objects.filter(
            organization=organization, provider="vercel"
        ).exists():
            logger.info(
                "vercel.post_install.installation_exists",
                extra={"organization_id": organization.id},
            )
            return

        user = User.objects.get(id=extra.get("user_id"))
        data = {
            "name": "Vercel Internal Integration",
            "author": "Auto-generated by Sentry",
            "organization": organization,
            "overview": internal_integration_overview.strip(),
            "user": user,
            "scopes": ["project:releases", "project:read", "project:write"],
        }
        # create the internal integration and link it to the join table
        sentry_app = InternalCreator.run(**data)
        sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=sentry_app)
        SentryAppInstallationForProvider.objects.create(
            sentry_app_installation=sentry_app_installation,
            organization=organization,
            provider="vercel",
        )
