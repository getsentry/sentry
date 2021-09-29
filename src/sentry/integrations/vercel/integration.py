import logging
from urllib.parse import urlencode

from django.utils.translation import ugettext_lazy as _
from rest_framework.serializers import ValidationError

from sentry import options
from sentry.constants import ObjectStatus
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.integrations import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.mediators.sentry_apps import InternalCreator
from sentry.models import (
    Organization,
    Project,
    ProjectKey,
    SentryAppInstallation,
    SentryAppInstallationForProvider,
    User,
)
from sentry.pipeline import NestedPipelineView
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.utils.compat import map
from sentry.utils.http import absolute_uri

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
    "url": f"https://vercel.com/integrations/{options.get('vercel.integration-slug')}/add",
    "buttonText": _("Vercel Marketplace"),
    "noticeText": _(INSTALL_NOTICE_TEXT),
}


configure_integration = {"title": _("Connect Your Projects")}
create_project_instruction = _("Don't have a project yet? Click [here]({}) to create one.")
install_source_code_integration = _(
    "Install a [source code integration]({}) and configure your repositories."
)

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Vercel%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/vercel",
    aspects={
        "externalInstall": external_install,
        "configure_integration": configure_integration,
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
            "/settings/%s/integrations/?%s"
            % (organization.slug, urlencode({"category": "source code management"}))
        )
        add_project_link = absolute_uri(f"/organizations/{organization.slug}/projects/new/")
        return {
            "configure_integration": {
                "instructions": [
                    create_project_instruction.format(add_project_link),
                    install_source_code_integration.format(source_code_link),
                ]
            }
        }

    def get_client(self):
        access_token = self.metadata["access_token"]
        if self.metadata["installation_type"] == "team":
            return VercelClient(access_token, self.model.external_id)

        return VercelClient(access_token)

    def get_configuration_id(self):
        # XXX(meredith): The "configurations" in the metadata is no longer
        # needed since Vercel restricted installation on their end to be
        # once per user/team. Eventually we should be able to just use
        # `self.metadata["installation_id"]`
        if not self.metadata.get("configurations"):
            return self.metadata["installation_id"]

        # note this could return a different integration if the user has multiple
        # installations with the same organization
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
        base_url = f"https://vercel.com/{slug}"
        vercel_projects = [
            {"value": p["id"], "label": p["name"], "url": "{}/{}".format(base_url, p["name"])}
            for p in vercel_client.get_projects()
        ]

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
                    "placeholder": _("Vercel project..."),
                },
                "sentryProjects": sentry_projects,
                "nextButton": {
                    "allowedDomain": "https://vercel.com",
                    "description": _(
                        "Link your Sentry projects to complete your installation on Vercel"
                    ),
                    "text": _("Complete on Vercel"),
                },
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
            raise ValidationError("Failed to update configuration.")

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

            sentry_project_dsn = enabled_dsn.get_dsn(public=True)

            vercel_project = vercel_client.get_project(vercel_project_id)
            source_code_provider = vercel_project.get("link", {}).get("type")

            if not source_code_provider:
                raise ValidationError(
                    {
                        "project_mappings": [
                            "You must connect your Vercel project to a Git repository to continue!"
                        ]
                    }
                )

            is_next_js = vercel_project.get("framework") == "nextjs"
            dsn_env_name = "NEXT_PUBLIC_SENTRY_DSN" if is_next_js else "SENTRY_DSN"

            sentry_auth_token = SentryAppInstallationForProvider.get_token(
                sentry_project.organization.id,
                "vercel",
            )

            env_var_map = {
                "SENTRY_ORG": {"type": "encrypted", "value": sentry_project.organization.slug},
                "SENTRY_PROJECT": {"type": "encrypted", "value": sentry_project.slug},
                dsn_env_name: {"type": "encrypted", "value": sentry_project_dsn},
                "SENTRY_AUTH_TOKEN": {
                    "type": "encrypted",
                    "value": sentry_auth_token,
                },
                "VERCEL_GIT_COMMIT_SHA": {"type": "system", "value": "VERCEL_GIT_COMMIT_SHA"},
            }

            for env_var, details in env_var_map.items():
                self.create_env_var(
                    vercel_client, vercel_project_id, env_var, details["value"], details["type"]
                )

        config.update(data)
        self.org_integration.update(config=config)

    def create_env_var(self, client, vercel_project_id, key, value, type):
        data = {
            "key": key,
            "value": value,
            "target": ["production"],
            "type": type,
        }
        try:
            return client.create_env_variable(vercel_project_id, data)
        except ApiError as e:
            if e.json and e.json.get("error", {}).get("code") == "ENV_ALREADY_EXISTS":
                return self.update_env_variable(client, vercel_project_id, data)
            raise

    def update_env_variable(self, client, vercel_project_id, data):
        envs = client.get_env_vars(vercel_project_id)["envs"]

        env_var_ids = [env_var["id"] for env_var in envs if env_var["key"] == data["key"]]
        if env_var_ids:
            return client.update_env_variable(vercel_project_id, env_var_ids[0], data)

        key = data["key"]
        raise IntegrationError(
            f"Could not update environment variable {key} in Vercel project {vercel_project_id}."
        )

    def uninstall(self):
        client = self.get_client()
        client.uninstall(self.get_configuration_id())


class VercelIntegrationProvider(IntegrationProvider):
    key = "vercel"
    name = "Vercel"
    can_add = False
    can_disable = False
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

        integration = {
            "name": name,
            "external_id": external_id,
            "metadata": {
                "access_token": access_token,
                "installation_id": data["installation_id"],
                "installation_type": installation_type,
            },
            "post_install_data": {"user_id": state["user_id"]},
        }

        return integration

    def post_install(self, integration, organization, extra=None):
        # check if we have an Vercel internal installation already
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
