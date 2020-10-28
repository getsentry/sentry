from __future__ import absolute_import

import logging
import six

from django.conf.urls import url
from rest_framework.response import Response
from uuid import uuid4

from social_auth.models import UserSocialAuth

from sentry import options
from sentry.app import locks
from sentry.exceptions import PluginError
from sentry.models import Integration, Organization, OrganizationOption, Repository
from sentry.plugins.bases.issue2 import IssuePlugin2, IssueGroupActionEndpoint
from sentry.plugins import providers
from sentry.utils.http import absolute_uri

from sentry_plugins.base import CorePluginMixin
from sentry.shared_integrations.constants import ERR_UNAUTHORIZED, ERR_INTERNAL
from sentry.shared_integrations.exceptions import ApiError
from sentry.integrations import FeatureDescription, IntegrationFeatures

from .client import GitHubClient, GitHubAppsClient

API_ERRORS = {
    404: "GitHub returned a 404 Not Found error. If this repository exists, ensure"
    " you have Admin or Owner permissions on the repository, and that Sentry is"
    " an authorized OAuth app in your GitHub account settings (https://github.com/settings/applications).",
    422: "GitHub returned a 422 Validation failed. This usually means that there is "
    "already a webhook set up for Sentry for this repository. Please go to your "
    "repository settings, click on the Webhooks tab, and delete the existing webhook "
    "before adding the repository again.",
    401: ERR_UNAUTHORIZED,
}

WEBHOOK_EVENTS = ["push", "pull_request"]


class GitHubMixin(CorePluginMixin):
    def message_from_error(self, exc):
        if isinstance(exc, ApiError):
            message = API_ERRORS.get(exc.code)
            if message:
                return message
            return "Error Communicating with GitHub (HTTP %s): %s" % (
                exc.code,
                exc.json.get("message", "unknown error") if exc.json else "unknown error",
            )
        else:
            return ERR_INTERNAL

    def get_client(self, user):
        auth = self.get_auth(user=user)
        if auth is None:
            raise PluginError(API_ERRORS[401])
        return GitHubClient(auth=auth)


# TODO(dcramer): half of this plugin is for the issue tracking integration
# (which is a singular entry) and the other half is generic GitHub. It'd be nice
# if plugins were entirely generic, and simply registered the various hooks.
class GitHubPlugin(GitHubMixin, IssuePlugin2):
    description = "Integrate GitHub issues by linking a repository to a project."
    slug = "github"
    title = "GitHub"
    conf_title = title
    conf_key = "github"
    auth_provider = "github"
    required_field = "repo"
    logger = logging.getLogger("sentry.plugins.github")
    feature_descriptions = [
        FeatureDescription(
            """
            Authorize repositories to be added to your Sentry organization to augment
            sentry issues with commit data with [deployment
            tracking](https://docs.sentry.io/learn/releases/).
            """,
            IntegrationFeatures.COMMITS,
        ),
        FeatureDescription(
            """
            Create and link Sentry issue groups directly to a GitHub issue or pull
            request in any of your repositories, providing a quick way to jump from
            Sentry bug to tracked issue or PR!
            """,
            IntegrationFeatures.ISSUE_BASIC,
        ),
    ]

    def get_group_urls(self):
        return super(GitHubPlugin, self).get_group_urls() + [
            url(
                r"^autocomplete",
                IssueGroupActionEndpoint.as_view(view_method_name="view_autocomplete", plugin=self),
            )
        ]

    def get_url_module(self):
        return "sentry_plugins.github.urls"

    def is_configured(self, request, project, **kwargs):
        return bool(self.get_option("repo", project))

    def get_new_issue_fields(self, request, group, event, **kwargs):
        fields = super(GitHubPlugin, self).get_new_issue_fields(request, group, event, **kwargs)
        return (
            [
                {
                    "name": "repo",
                    "label": "GitHub Repository",
                    "default": self.get_option("repo", group.project),
                    "type": "text",
                    "readonly": True,
                }
            ]
            + fields
            + [
                {
                    "name": "assignee",
                    "label": "Assignee",
                    "default": "",
                    "type": "select",
                    "required": False,
                    "choices": self.get_allowed_assignees(request, group),
                }
            ]
        )

    def get_link_existing_issue_fields(self, request, group, event, **kwargs):
        return [
            {
                "name": "issue_id",
                "label": "Issue",
                "default": "",
                "type": "select",
                "has_autocomplete": True,
                "help": (
                    "You can use any syntax supported by GitHub's "
                    '<a href="https://help.github.com/articles/searching-issues/" '
                    'target="_blank">issue search.</a>'
                ),
            },
            {
                "name": "comment",
                "label": "Comment",
                "default": u"Sentry issue: [{issue_id}]({url})".format(
                    url=absolute_uri(group.get_absolute_url(params={"referrer": "github_plugin"})),
                    issue_id=group.qualified_short_id,
                ),
                "type": "textarea",
                "help": ("Leave blank if you don't want to " "add a comment to the GitHub issue."),
                "required": False,
            },
        ]

    def get_allowed_assignees(self, request, group):
        client = self.get_client(request.user)
        try:
            response = client.list_assignees(repo=self.get_option("repo", group.project))
        except Exception as e:
            self.raise_error(e)

        users = tuple((u["login"], u["login"]) for u in response)

        return (("", "Unassigned"),) + users

    def create_issue(self, request, group, form_data, **kwargs):
        # TODO: support multiple identities via a selection input in the form?
        client = self.get_client(request.user)

        try:
            response = client.create_issue(
                repo=self.get_option("repo", group.project),
                data={
                    "title": form_data["title"],
                    "body": form_data["description"],
                    "assignee": form_data.get("assignee"),
                },
            )
        except Exception as e:
            self.raise_error(e)

        return response["number"]

    def link_issue(self, request, group, form_data, **kwargs):
        client = self.get_client(request.user)
        repo = self.get_option("repo", group.project)
        try:
            issue = client.get_issue(repo=repo, issue_id=form_data["issue_id"])
        except Exception as e:
            self.raise_error(e)

        comment = form_data.get("comment")
        if comment:
            try:
                client.create_comment(repo=repo, issue_id=issue["number"], data={"body": comment})
            except Exception as e:
                self.raise_error(e)

        return {"title": issue["title"]}

    def get_issue_label(self, group, issue_id, **kwargs):
        return "GH-%s" % issue_id

    def get_issue_url(self, group, issue_id, **kwargs):
        # XXX: get_option may need tweaked in Sentry so that it can be pre-fetched in bulk
        repo = self.get_option("repo", group.project)

        return "https://github.com/%s/issues/%s" % (repo, issue_id)

    def view_autocomplete(self, request, group, **kwargs):
        field = request.GET.get("autocomplete_field")
        query = request.GET.get("autocomplete_query")
        if field != "issue_id" or not query:
            return Response({"issue_id": []})

        repo = self.get_option("repo", group.project)
        client = self.get_client(request.user)

        try:
            response = client.search_issues(query=(u"repo:%s %s" % (repo, query)).encode("utf-8"))
        except Exception as e:
            return self.handle_api_error(e)

        issues = [
            {"text": "(#%s) %s" % (i["number"], i["title"]), "id": i["number"]}
            for i in response.get("items", [])
        ]

        return Response({field: issues})

    def get_configure_plugin_fields(self, request, project, **kwargs):
        return [
            {
                "name": "repo",
                "label": "Repository Name",
                "default": self.get_option("repo", project),
                "type": "text",
                "placeholder": "e.g. getsentry/sentry",
                "help": (
                    "If you want to add a repository to integrate commit data with releases, please install the "
                    'new <a href="/settings/{}/integrations/github/">'
                    "Github global integration</a>.  "
                    "You cannot add repositories to the legacy Github integration."
                ).format(project.organization.slug),
                "required": True,
            }
        ]

    def has_apps_configured(self):
        return bool(
            options.get("github.apps-install-url")
            and options.get("github.integration-app-id")
            and options.get("github.integration-hook-secret")
            and options.get("github.integration-private-key")
        )

    def setup(self, bindings):
        bindings.add("repository.provider", GitHubRepositoryProvider, id="github")
        if self.has_apps_configured():
            bindings.add("repository.provider", GitHubAppsRepositoryProvider, id="github_apps")
        else:
            self.logger.info("apps-not-configured")


class GitHubRepositoryProvider(GitHubMixin, providers.RepositoryProvider):
    name = "GitHub"
    auth_provider = "github"
    logger = logging.getLogger("sentry.plugins.github")

    def get_config(self):
        return [
            {
                "name": "name",
                "label": "Repository Name",
                "type": "text",
                "placeholder": "e.g. getsentry/sentry",
                "help": "Enter your repository name, including the owner.",
                "required": True,
            }
        ]

    def validate_config(self, organization, config, actor=None):
        """
        ```
        if config['foo'] and not config['bar']:
            raise PluginError('You cannot configure foo with bar')
        return config
        ```
        """
        if config.get("name"):
            client = self.get_client(actor)
            try:
                repo = client.get_repo(config["name"])
            except Exception as e:
                self.raise_error(e)
            else:
                config["external_id"] = six.text_type(repo["id"])
        return config

    def get_webhook_secret(self, organization):
        lock = locks.get("github:webhook-secret:{}".format(organization.id), duration=60)
        with lock.acquire():
            # TODO(dcramer): get_or_create would be a useful native solution
            secret = OrganizationOption.objects.get_value(
                organization=organization, key="github:webhook_secret"
            )
            if secret is None:
                secret = uuid4().hex + uuid4().hex
                OrganizationOption.objects.set_value(
                    organization=organization, key="github:webhook_secret", value=secret
                )
        return secret

    def _build_webhook_config(self, organization):
        return {
            "name": "web",
            "active": True,
            "events": WEBHOOK_EVENTS,
            "config": {
                "url": absolute_uri(
                    "/plugins/github/organizations/{}/webhook/".format(organization.id)
                ),
                "content_type": "json",
                "secret": self.get_webhook_secret(organization),
            },
        }

    def _create_webhook(self, client, organization, repo_name):
        return client.create_hook(repo_name, self._build_webhook_config(organization))

    def _update_webhook(self, client, organization, repo_name, webhook_id):
        return client.update_hook(repo_name, webhook_id, self._build_webhook_config(organization))

    def create_repository(self, organization, data, actor=None):
        if actor is None:
            raise NotImplementedError("Cannot create a repository anonymously")

        client = self.get_client(actor)

        try:
            resp = self._create_webhook(client, organization, data["name"])
        except Exception as e:
            self.logger.exception(
                "github.webhook.create-failure",
                extra={
                    "organization_id": organization.id,
                    "repository": data["name"],
                    "status_code": getattr(e, "code", None),
                },
            )

            self.raise_error(e)
        else:
            return {
                "name": data["name"],
                "external_id": data["external_id"],
                "url": "https://github.com/{}".format(data["name"]),
                "config": {
                    "name": data["name"],
                    "webhook_id": resp["id"],
                    "webhook_events": resp["events"],
                },
            }

    # TODO(dcramer): let's make this core functionality and move the actual database
    # updates into Sentry core
    def update_repository(self, repo, actor=None):
        if actor is None:
            raise NotImplementedError("Cannot update a repository anonymously")

        client = self.get_client(actor)
        org = Organization.objects.get(id=repo.organization_id)
        webhook_id = repo.config.get("webhook_id")
        if not webhook_id:
            resp = self._create_webhook(client, org, repo.config["name"])
        else:
            resp = self._update_webhook(client, org, repo.config["name"], repo.config["webhook_id"])
        repo.config.update({"webhook_id": resp["id"], "webhook_events": resp["events"]})
        repo.update(config=repo.config)

    def delete_repository(self, repo, actor=None):
        if actor is None:
            raise NotImplementedError("Cannot delete a repository anonymously")

        if "webhook_id" in repo.config:
            client = self.get_client(actor)
            try:
                client.delete_hook(repo.config["name"], repo.config["webhook_id"])
            except ApiError as exc:
                if exc.code == 404:
                    return
                raise

    def _format_commits(self, repo, commit_list):
        return [
            {
                "id": c["sha"],
                "repository": repo.name,
                "author_email": c["commit"]["author"].get("email"),
                "author_name": c["commit"]["author"].get("name"),
                "message": c["commit"]["message"],
            }
            for c in commit_list
        ]

    def compare_commits(self, repo, start_sha, end_sha, actor=None):
        if actor is None:
            raise NotImplementedError("Cannot fetch commits anonymously")
        client = self.get_client(actor)

        # use config name because that is kept in sync via webhooks
        name = repo.config["name"]
        if start_sha is None:
            try:
                res = client.get_last_commits(name, end_sha)
            except Exception as e:
                self.raise_error(e)
            else:
                return self._format_commits(repo, res[:10])
        else:
            try:
                res = client.compare_commits(name, start_sha, end_sha)
            except Exception as e:
                self.raise_error(e)
            else:
                return self._format_commits(repo, res["commits"])

        def get_pr_commits(self, repo, number, actor=None):
            # (not currently used by sentry)
            if actor is None:
                raise NotImplementedError("Cannot fetch commits anonymously")
            client = self.get_client(actor)

            # use config name because that is kept in sync via webhooks
            name = repo.config["name"]
            try:
                res = client.get_pr_commits(name, number)
            except Exception as e:
                self.raise_error(e)
            else:
                return self._format_commits(repo, res)


class GitHubAppsRepositoryProvider(GitHubRepositoryProvider):
    name = "GitHub Apps"
    auth_provider = "github_apps"
    logger = logging.getLogger("sentry.plugins.github_apps")

    def get_install_url(self):
        return options.get("github.apps-install-url")

    def get_available_auths(self, user, organization, integrations, social_auths, **kwargs):
        allowed_gh_installations = set(self.get_installations(user))

        linked_integrations = {i.id for i in integrations}

        _integrations = list(Integration.objects.filter(external_id__in=allowed_gh_installations))

        # add in integrations that might have been set up for org
        # by users w diff permissions
        _integrations.extend(
            [i for i in integrations if i.external_id not in allowed_gh_installations]
        )

        return [
            {
                "defaultAuthId": None,
                "user": None,
                "externalId": i.external_id,
                "integrationId": six.text_type(i.id),
                "linked": i.id in linked_integrations,
            }
            for i in _integrations
        ]

    def link_auth(self, user, organization, data):
        integration_id = data["integration_id"]

        try:
            integration = Integration.objects.get(provider=self.auth_provider, id=integration_id)
        except Integration.DoesNotExist:
            raise PluginError("Invalid integration id")

        # check that user actually has access to add
        allowed_gh_installations = set(self.get_installations(user))
        if int(integration.external_id) not in allowed_gh_installations:
            raise PluginError("You do not have access to that integration")

        integration.add_organization(organization)

        for repo in self.get_repositories(integration):
            # TODO(jess): figure out way to migrate from github --> github apps
            Repository.objects.create_or_update(
                organization_id=organization.id,
                name=repo["name"],
                external_id=repo["external_id"],
                provider="github_apps",
                values={
                    "integration_id": integration.id,
                    "url": repo["url"],
                    "config": repo["config"],
                },
            )

    def delete_repository(self, repo, actor=None):
        if actor is None:
            raise NotImplementedError("Cannot delete a repository anonymously")

        # there isn't a webhook to delete for integrations
        if not repo.config.get("webhook_id") and repo.integration_id is not None:
            return

        return super(GitHubAppsRepositoryProvider, self).delete_repository(repo, actor=actor)

    def compare_commits(self, repo, start_sha, end_sha, actor=None):
        integration_id = repo.integration_id
        if integration_id is None:
            raise NotImplementedError("GitHub apps requires an integration id to fetch commits")

        client = GitHubAppsClient(Integration.objects.get(id=integration_id))

        # use config name because that is kept in sync via webhooks
        name = repo.config["name"]
        if start_sha is None:
            try:
                res = client.get_last_commits(name, end_sha)
            except Exception as e:
                self.raise_error(e)
            else:
                return self._format_commits(repo, res[:10])
        else:
            try:
                res = client.compare_commits(name, start_sha, end_sha)
            except Exception as e:
                self.raise_error(e)
            else:
                return self._format_commits(repo, res["commits"])

    def get_installations(self, actor):
        if not actor.is_authenticated():
            raise PluginError(API_ERRORS[401])

        auth = UserSocialAuth.objects.filter(user=actor, provider="github_apps").first()

        if not auth:
            self.logger.warn("get_installations.no-linked-auth")
            return []

        client = GitHubClient(auth=auth)

        res = client.get_installations()

        return [install["id"] for install in res["installations"]]

    def get_repositories(self, integration):
        client = GitHubAppsClient(integration)

        res = client.get_repositories()
        return [
            {
                "name": "%s/%s" % (r["owner"]["login"], r["name"]),
                "external_id": r["id"],
                "url": r["html_url"],
                "config": {"name": "%s/%s" % (r["owner"]["login"], r["name"])},
            }
            for r in res["repositories"]
        ]
