import hashlib
import hmac
import logging

import dateutil.parser
from django.db import IntegrityError, transaction
from django.http import Http404, HttpResponse
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View

from sentry import options
from sentry.models import (
    Commit,
    CommitAuthor,
    CommitFileChange,
    Integration,
    Organization,
    OrganizationOption,
    PullRequest,
    Repository,
    User,
)
from sentry.plugins.providers import RepositoryProvider
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import json
from sentry_plugins.github.client import GitHubClient

logger = logging.getLogger("sentry.webhooks")


def is_anonymous_email(email):
    return email[-25:] == "@users.noreply.github.com"


def get_external_id(username):
    return "github:%s" % username


class Webhook:
    def __call__(self, event, organization=None):
        raise NotImplementedError


class InstallationEventWebhook(Webhook):
    # https://developer.github.com/v3/activity/events/types/#installationevent
    def __call__(self, event, organization=None):
        action = event["action"]
        installation = event["installation"]
        # TODO(jess): handle uninstalls
        if action == "created":
            try:
                with transaction.atomic():
                    Integration.objects.create(
                        provider="github_apps",
                        external_id=installation["id"],
                        name=installation["account"]["login"],
                    )
            except IntegrityError:
                pass


class InstallationRepositoryEventWebhook(Webhook):
    # https://developer.github.com/v3/activity/events/types/#installationrepositoriesevent
    def __call__(self, event, organization=None):
        installation = event["installation"]

        integration = Integration.objects.get(
            external_id=installation["id"], provider="github_apps"
        )

        repos_added = event["repositories_added"]

        if repos_added:
            for org_id in integration.organizations.values_list("id", flat=True):
                for r in repos_added:
                    config = {"name": r["full_name"]}
                    repo, created = Repository.objects.get_or_create(
                        organization_id=org_id,
                        name=r["full_name"],
                        provider="github",
                        external_id=r["id"],
                        defaults={
                            "url": "https://github.com/{}".format(r["full_name"]),
                            "config": config,
                            "integration_id": integration.id,
                        },
                    )
                    if not created:
                        repo.config.update(config)
                        repo.integration_id = integration.id
                        repo.save()
        # TODO(jess): what do we want to do when they're removed?
        # maybe signify that we've lost access but not deleted?


class PushEventWebhook(Webhook):
    def _handle(self, event, organization, is_apps):
        authors = {}

        gh_username_cache = {}

        try:
            repo = Repository.objects.get(
                organization_id=organization.id,
                provider="github_apps" if is_apps else "github",
                external_id=str(event["repository"]["id"]),
            )
        except Repository.DoesNotExist:
            raise Http404()

        # We need to track GitHub's "full_name" which is the repository slug.
        # This is needed to access the API since `external_id` isn't sufficient.
        if repo.config.get("name") != event["repository"]["full_name"]:
            repo.config["name"] = event["repository"]["full_name"]
            repo.save()

        for commit in event["commits"]:
            if not commit["distinct"]:
                continue

            if RepositoryProvider.should_ignore_commit(commit["message"]):
                continue

            author_email = commit["author"]["email"]
            if "@" not in author_email:
                author_email = f"{author_email[:65]}@localhost"
            # try to figure out who anonymous emails are
            elif is_anonymous_email(author_email):
                gh_username = commit["author"].get("username")
                # bot users don't have usernames
                if gh_username:
                    external_id = get_external_id(gh_username)
                    if gh_username in gh_username_cache:
                        author_email = gh_username_cache[gh_username] or author_email
                    else:
                        try:
                            commit_author = CommitAuthor.objects.get(
                                external_id=external_id, organization_id=organization.id
                            )
                        except CommitAuthor.DoesNotExist:
                            commit_author = None

                        if commit_author is not None and not is_anonymous_email(
                            commit_author.email
                        ):
                            author_email = commit_author.email
                            gh_username_cache[gh_username] = author_email
                        else:
                            try:
                                with GitHubClient() as client:
                                    gh_user = client.request_no_auth("GET", f"/users/{gh_username}")
                            except ApiError as exc:
                                logger.exception(str(exc))
                            else:
                                # even if we can't find a user, set to none so we
                                # don't re-query
                                gh_username_cache[gh_username] = None
                                try:
                                    user = User.objects.filter(
                                        social_auth__provider="github",
                                        social_auth__uid=gh_user["id"],
                                        org_memberships=organization,
                                    )[0]
                                except IndexError:
                                    pass
                                else:
                                    author_email = user.email
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
                    external_id = get_external_id(gh_username)
                    if author.external_id != external_id and not is_anonymous_email(author.email):
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

    # https://developer.github.com/v3/activity/events/types/#pushevent
    def __call__(self, event, organization=None):
        is_apps = "installation" in event
        if organization is None:
            if "installation" not in event:
                return

            integration = Integration.objects.get(
                external_id=event["installation"]["id"], provider="github_apps"
            )
            organizations = list(integration.organizations.all())
        else:
            organizations = [organization]

        for org in organizations:
            self._handle(event, org, is_apps)


class PullRequestEventWebhook(Webhook):
    # https://developer.github.com/v3/activity/events/types/#pullrequestevent
    def __call__(self, event, organization):
        # TODO(maxbittker) handle is_apps correctly (What does this comment mean?)
        is_apps = "installation" in event
        try:
            repo = Repository.objects.get(
                organization_id=organization.id,
                provider="github_apps" if is_apps else "github",
                external_id=str(event["repository"]["id"]),
            )

        except Repository.DoesNotExist:
            raise Http404()

        # We need to track GitHub's "full_name" which is the repository slug.
        # This is needed to access the API since `external_id` isn't sufficient.
        if repo.config.get("name") != event["repository"]["full_name"]:
            repo.config["name"] = event["repository"]["full_name"]
            repo.save()

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
                external_id=get_external_id(user["login"]), organization_id=organization.id
            )
            author_email = commit_author.email
        except CommitAuthor.DoesNotExist:
            try:
                user_model = User.objects.filter(
                    social_auth__provider="github",
                    social_auth__uid=user["id"],
                    org_memberships=organization,
                )[0]
            except IndexError:
                pass
            else:
                author_email = user_model.email

        try:
            author = CommitAuthor.objects.get(
                organization_id=organization.id, external_id=get_external_id(user["login"])
            )
        except CommitAuthor.DoesNotExist:
            try:
                author = CommitAuthor.objects.get(
                    organization_id=organization.id, email=author_email
                )
            except CommitAuthor.DoesNotExist:
                author = CommitAuthor.objects.create(
                    organization_id=organization.id,
                    email=author_email,
                    external_id=get_external_id(user["login"]),
                    name=user["login"][:128],
                )

        try:
            PullRequest.objects.create_or_update(
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


class GithubWebhookBase(View):
    _handlers = {"push": PushEventWebhook, "pull_request": PullRequestEventWebhook}

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

    def get_logging_data(self, organization):
        pass

    def get_secret(self, organization):
        raise NotImplementedError

    def handle(self, request, organization=None):
        secret = self.get_secret(organization)

        if secret is None:
            logger.error("github.webhook.missing-secret", extra=self.get_logging_data(organization))
            return HttpResponse(status=401)

        body = bytes(request.body)
        if not body:
            logger.error("github.webhook.missing-body", extra=self.get_logging_data(organization))
            return HttpResponse(status=400)

        try:
            handler = self.get_handler(request.META["HTTP_X_GITHUB_EVENT"])
        except KeyError:
            logger.error("github.webhook.missing-event", extra=self.get_logging_data(organization))
            return HttpResponse(status=400)

        if not handler:
            return HttpResponse(status=204)

        try:
            method, signature = request.META["HTTP_X_HUB_SIGNATURE"].split("=", 1)
        except (KeyError, IndexError):
            logger.error(
                "github.webhook.missing-signature", extra=self.get_logging_data(organization)
            )
            return HttpResponse(status=400)

        if not self.is_valid_signature(method, body, self.get_secret(organization), signature):
            logger.error(
                "github.webhook.invalid-signature", extra=self.get_logging_data(organization)
            )
            return HttpResponse(status=401)

        try:
            event = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            logger.error(
                "github.webhook.invalid-json",
                extra=self.get_logging_data(organization),
                exc_info=True,
            )
            return HttpResponse(status=400)

        handler()(event, organization=organization)
        return HttpResponse(status=204)


# non-integration version
class GithubWebhookEndpoint(GithubWebhookBase):
    def get_logging_data(self, organization):
        return {"organization_id": organization.id}

    def get_secret(self, organization):
        return OrganizationOption.objects.get_value(
            organization=organization, key="github:webhook_secret"
        )

    def post(self, request, organization_id):
        try:
            organization = Organization.objects.get_from_cache(id=organization_id)
        except Organization.DoesNotExist:
            logger.info(
                "github.webhook.invalid-organization", extra={"organization_id": organization_id}
            )
            return HttpResponse(status=400)

        return self.handle(request, organization=organization)


class GithubIntegrationsWebhookEndpoint(GithubWebhookBase):
    _handlers = {
        "push": PushEventWebhook,
        "installation": InstallationEventWebhook,
        "installation_repositories": InstallationRepositoryEventWebhook,
    }

    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        if request.method != "POST":
            return HttpResponse(status=405)

        return super().dispatch(request, *args, **kwargs)

    def get_secret(self, organization):
        return options.get("github.integration-hook-secret")

    def post(self, request):
        return self.handle(request)
