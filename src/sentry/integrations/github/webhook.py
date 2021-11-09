import hashlib
import hmac
import logging

import dateutil.parser
from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View

from sentry import options
from sentry.constants import ObjectStatus
from sentry.models import (
    Commit,
    CommitAuthor,
    CommitFileChange,
    Identity,
    Integration,
    PullRequest,
    Repository,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import json

from .repository import GitHubRepositoryProvider

logger = logging.getLogger("sentry.webhooks")


class Webhook:
    provider = "github"

    def _handle(self, integration, event, organization, repo):
        raise NotImplementedError

    def __call__(self, event, host=None):
        external_id = event["installation"]["id"]
        if host:
            external_id = "{}:{}".format(host, event["installation"]["id"])

        try:
            integration = Integration.objects.get(external_id=external_id, provider=self.provider)
        except Integration.DoesNotExist:
            # It seems possible for the GH or GHE app to be installed on their
            # end, but the integration to not exist. Possibly from deleting in
            # Sentry first or from a failed install flow (where the integration
            # didn't get created in the first place)
            logger.info(
                "github.missing-integration",
                extra={
                    "action": event.get("action"),
                    "repository": event.get("repository", {}).get("full_name", None),
                    "external_id": str(external_id),
                },
            )
            return

        if "repository" in event:

            orgs = {org.id: org for org in integration.organizations.all()}

            repos = Repository.objects.filter(
                organization_id__in=orgs.keys(),
                provider=f"integrations:{self.provider}",
                external_id=str(event["repository"]["id"]),
            )
            for repo in repos:
                self._handle(integration, event, orgs[repo.organization_id], repo)

    def update_repo_data(self, repo, event):
        """
        Given a webhook payload, update stored repo data if needed.

        Assumes a 'repository' key in event payload, with certain subkeys.
        Rework this if that stops being a safe assumption.

        XXX(meredith): In it's current state, this tends to cause a lot of
        IntegrityErrors when we try to update the repo. Those would need to
        be handled should we decided to add this back in. Keeping the method
        for now, even though it's not currently used.
        """

        name_from_event = event["repository"]["full_name"]
        url_from_event = event["repository"]["html_url"]

        if (
            repo.name != name_from_event
            or repo.config.get("name") != name_from_event
            or repo.url != url_from_event
        ):
            repo.update(
                name=name_from_event,
                url=url_from_event,
                config=dict(repo.config, name=name_from_event),
            )


class InstallationEventWebhook(Webhook):
    # https://developer.github.com/v3/activity/events/types/#installationevent
    def __call__(self, event, host=None):
        installation = event["installation"]
        if installation and event["action"] == "deleted":
            external_id = event["installation"]["id"]
            if host:
                external_id = "{}:{}".format(host, event["installation"]["id"])
            try:
                integration = Integration.objects.get(
                    external_id=external_id, provider=self.provider
                )
                self._handle_delete(event, integration)
            except Integration.DoesNotExist:
                # It seems possible for the GH or GHE app to be installed on their
                # end, but the integration to not exist. Possibly from deleting in
                # Sentry first or from a failed install flow (where the integration
                # didn't get created in the first place)
                logger.info(
                    "github.deletion-missing-integration",
                    extra={
                        "action": event["action"],
                        "installation_name": installation["account"]["login"],
                        "external_id": str(external_id),
                    },
                )

    def _handle_delete(self, event, integration):

        organizations = integration.organizations.all()

        logger.info(
            "InstallationEventWebhook._handle_delete",
            extra={
                "external_id": event["installation"]["id"],
                "integration_id": integration.id,
                "organization_id_list": organizations.values_list("id", flat=True),
            },
        )

        integration.update(status=ObjectStatus.DISABLED)

        Repository.objects.filter(
            organization_id__in=organizations.values_list("id", flat=True),
            provider=f"integrations:{self.provider}",
            integration_id=integration.id,
        ).update(status=ObjectStatus.DISABLED)


class InstallationRepositoryEventWebhook(Webhook):
    # https://developer.github.com/v3/activity/events/types/#installationrepositoriesevent
    def _handle(self, integration, event, organization, repo):
        pass


class PushEventWebhook(Webhook):
    # https://developer.github.com/v3/activity/events/types/#pushevent

    def is_anonymous_email(self, email):
        return email[-25:] == "@users.noreply.github.com"

    def get_external_id(self, username):
        return f"github:{username}"

    def get_idp_external_id(self, integration, host=None):
        return options.get("github-app.id")

    def should_ignore_commit(self, commit):
        return GitHubRepositoryProvider.should_ignore_commit(commit["message"])

    def _handle(self, integration, event, organization, repo, host=None):
        authors = {}
        client = integration.get_installation(organization_id=organization.id).get_client()
        gh_username_cache = {}

        for commit in event["commits"]:
            if not commit["distinct"]:
                continue

            if self.should_ignore_commit(commit):
                continue

            author_email = commit["author"]["email"]
            if "@" not in author_email:
                author_email = f"{author_email[:65]}@localhost"
            # try to figure out who anonymous emails are
            elif self.is_anonymous_email(author_email):
                gh_username = commit["author"].get("username")
                # bot users don't have usernames
                if gh_username:
                    external_id = self.get_external_id(gh_username)
                    if gh_username in gh_username_cache:
                        author_email = gh_username_cache[gh_username] or author_email
                    else:
                        try:
                            commit_author = CommitAuthor.objects.get(
                                external_id=external_id, organization_id=organization.id
                            )
                        except CommitAuthor.DoesNotExist:
                            commit_author = None

                        if commit_author is not None and not self.is_anonymous_email(
                            commit_author.email
                        ):
                            author_email = commit_author.email
                            gh_username_cache[gh_username] = author_email
                        else:
                            try:
                                gh_user = client.get_user(gh_username)
                            except ApiError as exc:
                                logger.exception(str(exc))
                            else:
                                # even if we can't find a user, set to none so we
                                # don't re-query
                                gh_username_cache[gh_username] = None
                                try:
                                    identity = Identity.objects.get(
                                        external_id=gh_user["id"],
                                        idp__type=self.provider,
                                        idp__external_id=self.get_idp_external_id(
                                            integration, host
                                        ),
                                    )
                                except Identity.DoesNotExist:
                                    pass
                                else:
                                    author_email = identity.user.email
                                    gh_username_cache[gh_username] = author_email
                                    if commit_author is not None:
                                        try:
                                            with transaction.atomic():
                                                commit_author.update(
                                                    email=author_email, external_id=external_id
                                                )
                                        except IntegrityError:
                                            pass

                        if commit_author is not None:
                            authors[author_email] = commit_author

            # TODO(dcramer): we need to deal with bad values here, but since
            # its optional, lets just throw it out for now
            if len(author_email) > 75:
                author = None
            elif author_email not in authors:
                authors[author_email] = author = CommitAuthor.objects.get_or_create(
                    organization_id=organization.id,
                    email=author_email,
                    defaults={"name": commit["author"]["name"][:128]},
                )[0]

                update_kwargs = {}

                if author.name != commit["author"]["name"][:128]:
                    update_kwargs["name"] = commit["author"]["name"][:128]

                gh_username = commit["author"].get("username")
                if gh_username:
                    external_id = self.get_external_id(gh_username)
                    if author.external_id != external_id and not self.is_anonymous_email(
                        author.email
                    ):
                        update_kwargs["external_id"] = external_id

                if update_kwargs:
                    try:
                        with transaction.atomic():
                            author.update(**update_kwargs)
                    except IntegrityError:
                        pass
            else:
                author = authors[author_email]

            try:
                with transaction.atomic():
                    c = Commit.objects.create(
                        repository_id=repo.id,
                        organization_id=organization.id,
                        key=commit["id"],
                        message=commit["message"],
                        author=author,
                        date_added=dateutil.parser.parse(commit["timestamp"]).astimezone(
                            timezone.utc
                        ),
                    )
                    for fname in commit["added"]:
                        CommitFileChange.objects.create(
                            organization_id=organization.id, commit=c, filename=fname, type="A"
                        )
                    for fname in commit["removed"]:
                        CommitFileChange.objects.create(
                            organization_id=organization.id, commit=c, filename=fname, type="D"
                        )
                    for fname in commit["modified"]:
                        CommitFileChange.objects.create(
                            organization_id=organization.id, commit=c, filename=fname, type="M"
                        )
            except IntegrityError:
                pass


class PullRequestEventWebhook(Webhook):
    # https://developer.github.com/v3/activity/events/types/#pullrequestevent
    def is_anonymous_email(self, email):
        return email[-25:] == "@users.noreply.github.com"

    def get_external_id(self, username):
        return f"github:{username}"

    def get_idp_external_id(self, integration, host=None):
        return options.get("github-app.id")

    def _handle(self, integration, event, organization, repo, host=None):
        pull_request = event["pull_request"]
        number = pull_request["number"]
        title = pull_request["title"]
        body = pull_request["body"]
        user = pull_request["user"]

        # The value of the merge_commit_sha attribute changes depending on the state of the pull request. Before a pull request is merged, the merge_commit_sha attribute holds the SHA of the test merge commit. After a pull request is merged, the attribute changes depending on how the pull request was merged:
        # - If the pull request was merged as a merge commit, the attribute represents the SHA of the merge commit.
        # - If the pull request was merged via a squash, the attribute represents the SHA of the squashed commit on the base branch.
        # - If the pull request was rebased, the attribute represents the commit that the base branch was updated to.
        # https://developer.github.com/v3/pulls/#get-a-single-pull-request
        merge_commit_sha = pull_request["merge_commit_sha"] if pull_request["merged"] else None

        author_email = "{}@localhost".format(user["login"][:65])
        try:
            commit_author = CommitAuthor.objects.get(
                external_id=self.get_external_id(user["login"]), organization_id=organization.id
            )
            author_email = commit_author.email
        except CommitAuthor.DoesNotExist:
            try:
                identity = Identity.objects.get(
                    external_id=user["id"],
                    idp__type=self.provider,
                    idp__external_id=self.get_idp_external_id(integration, host),
                )
            except Identity.DoesNotExist:
                pass
            else:
                author_email = identity.user.email

        try:
            author = CommitAuthor.objects.get(
                organization_id=organization.id, external_id=self.get_external_id(user["login"])
            )
        except CommitAuthor.DoesNotExist:
            author, _created = CommitAuthor.objects.get_or_create(
                organization_id=organization.id,
                email=author_email,
                defaults={
                    "name": user["login"][:128],
                    "external_id": self.get_external_id(user["login"]),
                },
            )

        try:
            PullRequest.create_or_save(
                organization_id=organization.id,
                repository_id=repo.id,
                key=number,
                values={
                    "organization_id": organization.id,
                    "title": title,
                    "author": author,
                    "message": body,
                    "merge_commit_sha": merge_commit_sha,
                },
            )
        except IntegrityError:
            pass


class GitHubWebhookBase(View):
    # https://developer.github.com/webhooks/
    def get_handler(self, event_type):
        return self._handlers.get(event_type)

    def is_valid_signature(self, method, body, secret, signature):
        if method == "sha1":
            mod = hashlib.sha1
        else:
            raise NotImplementedError(f"signature method {method} is not supported")
        expected = hmac.new(key=secret.encode("utf-8"), msg=body, digestmod=mod).hexdigest()
        return constant_time_compare(expected, signature)

    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        if request.method != "POST":
            return HttpResponse(status=405)

        return super().dispatch(request, *args, **kwargs)

    def get_logging_data(self):
        pass

    def get_secret(self):
        raise NotImplementedError

    def handle(self, request):
        secret = self.get_secret()

        if secret is None:
            logger.error("github.webhook.missing-secret", extra=self.get_logging_data())
            return HttpResponse(status=401)

        body = bytes(request.body)
        if not body:
            logger.error("github.webhook.missing-body", extra=self.get_logging_data())
            return HttpResponse(status=400)

        try:
            handler = self.get_handler(request.META["HTTP_X_GITHUB_EVENT"])
        except KeyError:
            logger.error("github.webhook.missing-event", extra=self.get_logging_data())
            return HttpResponse(status=400)

        if not handler:
            return HttpResponse(status=204)

        try:
            method, signature = request.META["HTTP_X_HUB_SIGNATURE"].split("=", 1)
        except (KeyError, IndexError):
            logger.error("github.webhook.missing-signature", extra=self.get_logging_data())
            return HttpResponse(status=400)

        if not self.is_valid_signature(method, body, self.get_secret(), signature):
            logger.error("github.webhook.invalid-signature", extra=self.get_logging_data())
            return HttpResponse(status=401)

        try:
            event = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            logger.error(
                "github.webhook.invalid-json", extra=self.get_logging_data(), exc_info=True
            )
            return HttpResponse(status=400)

        handler()(event)
        return HttpResponse(status=204)


class GitHubIntegrationsWebhookEndpoint(GitHubWebhookBase):
    _handlers = {
        "push": PushEventWebhook,
        "pull_request": PullRequestEventWebhook,
        "installation": InstallationEventWebhook,
        "installation_repositories": InstallationRepositoryEventWebhook,
    }

    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        if request.method != "POST":
            return HttpResponse(status=405)

        return super().dispatch(request, *args, **kwargs)

    def get_secret(self):
        return options.get("github-app.webhook-secret")

    def post(self, request):
        return self.handle(request)
