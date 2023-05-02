import logging

from dateutil.parser import parse as parse_date
from django.db import IntegrityError, transaction
from django.http import Http404, HttpResponse
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.integrations.utils.scope import clear_tags_and_context
from sentry.models import Commit, CommitAuthor, PullRequest, Repository
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.utils import json

logger = logging.getLogger("sentry.webhooks")

PROVIDER_NAME = "integrations:gitlab"


class Webhook:
    def __call__(self, integration, organization, event):
        raise NotImplementedError

    def get_repo(self, integration, organization, event):
        """
        Given a webhook payload, get the associated Repository record.

        Assumes a 'project' key in event payload.
        """
        try:
            project_id = event["project"]["id"]
        except KeyError:
            logger.info(
                "gitlab.webhook.missing-projectid", extra={"integration_id": integration.id}
            )
            logger.exception("Missing project ID.")
            raise Http404()

        external_id = "{}:{}".format(integration.metadata["instance"], project_id)
        try:
            repo = Repository.objects.get(
                organization_id=organization.id, provider=PROVIDER_NAME, external_id=external_id
            )
        except Repository.DoesNotExist:
            return None
        return repo

    def update_repo_data(self, repo, event):
        """
        Given a webhook payload, update stored repo data if needed.

        Assumes a 'project' key in event payload, with certain subkeys. Rework
        this if that stops being a safe assumption.
        """

        project = event["project"]

        url_from_event = project["web_url"]
        path_from_event = project["path_with_namespace"]

        if repo.url != url_from_event or repo.config.get("path") != path_from_event:
            repo.update(
                url=url_from_event,
                config=dict(repo.config, path=path_from_event),
            )


class MergeEventWebhook(Webhook):
    """
    Handle Merge Request Hook

    See https://docs.gitlab.com/ee/user/project/integrations/webhooks.html#merge-request-events
    """

    def __call__(self, integration, organization, event):
        repo = self.get_repo(integration, organization, event)
        if repo is None:
            return

        # while we're here, make sure repo data is up to date
        self.update_repo_data(repo, event)

        try:
            number = event["object_attributes"]["iid"]
            title = event["object_attributes"]["title"]
            body = event["object_attributes"]["description"]
            created_at = event["object_attributes"]["created_at"]
            merge_commit_sha = event["object_attributes"]["merge_commit_sha"]

            last_commit = event["object_attributes"]["last_commit"]
            author_email = None
            author_name = None
            if last_commit:
                author_email = last_commit["author"]["email"]
                author_name = last_commit["author"]["name"]
        except KeyError as e:
            logger.info(
                "gitlab.webhook.invalid-merge-data",
                extra={"integration_id": integration.id, "error": str(e)},
            )
            logger.exception("Invalid merge data.")
            # TODO(mgaeta): This try/catch is full of reportUnboundVariable errors.
            return

        if not author_email:
            raise Http404()

        author = CommitAuthor.objects.get_or_create(
            organization_id=organization.id, email=author_email, defaults={"name": author_name}
        )[0]

        try:
            PullRequest.objects.update_or_create(
                organization_id=organization.id,
                repository_id=repo.id,
                key=number,
                defaults={
                    "title": title,
                    "author": author,
                    "message": body,
                    "merge_commit_sha": merge_commit_sha,
                    "date_added": parse_date(created_at).astimezone(timezone.utc),
                },
            )
        except IntegrityError:
            pass


class PushEventWebhook(Webhook):
    """
    Handle push hook

    See https://docs.gitlab.com/ee/user/project/integrations/webhooks.html#push-events
    """

    def __call__(self, integration, organization, event):
        repo = self.get_repo(integration, organization, event)
        if repo is None:
            return

        # while we're here, make sure repo data is up to date
        self.update_repo_data(repo, event)

        authors = {}

        # TODO gitlab only sends a max of 20 commits. If a push contains
        # more commits they provide a total count and require additional API
        # requests to fetch the commit details
        for commit in event.get("commits", []):
            if IntegrationRepositoryProvider.should_ignore_commit(commit["message"]):
                continue

            author_email = commit["author"]["email"]

            # TODO(dcramer): we need to deal with bad values here, but since
            # its optional, lets just throw it out for now
            if author_email is None or len(author_email) > 75:
                author = None
            elif author_email not in authors:
                authors[author_email] = author = CommitAuthor.objects.get_or_create(
                    organization_id=organization.id,
                    email=author_email,
                    defaults={"name": commit["author"]["name"]},
                )[0]
            else:
                author = authors[author_email]
            try:
                with transaction.atomic():
                    Commit.objects.create(
                        repository_id=repo.id,
                        organization_id=organization.id,
                        key=commit["id"],
                        message=commit["message"],
                        author=author,
                        date_added=parse_date(commit["timestamp"]).astimezone(timezone.utc),
                    )
            except IntegrityError:
                pass


class GitlabWebhookEndpoint(View):
    provider = "gitlab"

    _handlers = {"Push Hook": PushEventWebhook, "Merge Request Hook": MergeEventWebhook}

    @method_decorator(csrf_exempt)
    def dispatch(self, request: Request, *args, **kwargs) -> Response:
        if request.method != "POST":
            return HttpResponse(status=405, reason="HTTP method not supported.")

        return super().dispatch(request, *args, **kwargs)

    def post(self, request: Request) -> Response:
        clear_tags_and_context()
        extra = {
            # This tells us the Gitlab version being used (e.g. current gitlab.com version -> GitLab/15.4.0-pre)
            "user-agent": request.META.get("HTTP_USER_AGENT"),
            # Gitlab does not seem to be the only host sending events
            # AppPlatformEvents also hit this API
            "event-type": request.META.get("HTTP_X_GITLAB_EVENT"),
        }
        token = "<unknown>"
        try:
            # Munge the token to extract the integration external_id.
            # gitlab hook payloads don't give us enough unique context
            # to find data on our side so we embed one in the token.
            token = request.META["HTTP_X_GITLAB_TOKEN"]
            # e.g. "example.gitlab.com:group-x:webhook_secret_from_sentry_integration_table"
            instance, group_path, secret = token.split(":")
            external_id = f"{instance}:{group_path}"
        except KeyError:
            logger.info("gitlab.webhook.missing-gitlab-token")
            extra["reason"] = "The customer needs to set a Secret Token in their webhook."
            logger.exception(extra["reason"])
            return HttpResponse(status=400, reason=extra["reason"])
        except ValueError:
            logger.info("gitlab.webhook.malformed-gitlab-token", extra=extra)
            extra["reason"] = "The customer's Secret Token is malformed."
            logger.exception(extra["reason"])
            return HttpResponse(status=400, reason=extra["reason"])
        except Exception:
            logger.info("gitlab.webhook.invalid-token", extra=extra)
            extra["reason"] = "Generic catch-all error."
            logger.exception(extra["reason"])
            return HttpResponse(status=400, reason=extra["reason"])

        integration, installs = integration_service.get_organization_contexts(
            provider=self.provider, external_id=external_id
        )
        if integration is None:
            logger.info("gitlab.webhook.invalid-organization", extra=extra)
            extra["reason"] = "There is no integration that matches your organization."
            logger.exception(extra["reason"])
            return HttpResponse(status=400, reason=extra["reason"])

        extra = {
            **extra,
            **{
                "integration": {
                    # The metadata could be useful to debug
                    # domain_name -> gitlab.com/getsentry-ecosystem/foo'
                    # scopes -> ['api']
                    "metadata": integration.metadata,
                    "id": integration.id,  # This is useful to query via Redash
                    "status": integration.status,  # 0 seems to be active
                },
                "org_ids": [install.organization_id for install in installs],
            },
        }

        try:
            if not constant_time_compare(secret, integration.metadata["webhook_secret"]):
                # Summary and potential workaround mentioned here:
                # https://github.com/getsentry/sentry/issues/34903#issuecomment-1262754478
                # This forces a stack trace to be produced
                raise Exception("The webhook secrets do not match.")
        except Exception:
            logger.info("gitlab.webhook.invalid-token-secret", extra=extra)
            extra[
                "reason"
            ] = "Gitlab's webhook secret does not match. Refresh token (or re-install the integration) by following this https://docs.sentry.io/product/integrations/integration-platform/public-integration/#refreshing-tokens."
            logger.exception(extra["reason"])
            return HttpResponse(status=400, reason=extra["reason"])

        try:
            event = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            logger.info("gitlab.webhook.invalid-json", extra=extra)
            extra["reason"] = "Data received is not JSON."
            logger.exception(extra["reason"])
            return HttpResponse(status=400, reason=extra["reason"])

        try:
            handler = self._handlers[request.META["HTTP_X_GITLAB_EVENT"]]
        except KeyError:
            logger.info("gitlab.webhook.wrong-event-type", extra=extra)
            supported_events = ", ".join(sorted(self._handlers.keys()))
            logger.info(f"We only support these kinds of events: {supported_events}")
            extra[
                "reason"
            ] = "The customer has edited the webhook in Gitlab to include other types of events."
            logger.exception(extra["reason"])
            return HttpResponse(status=400, reason=extra["reason"])

        for install in installs:
            org_context = organization_service.get_organization_by_id(id=install.organization_id)
            if org_context:
                organization = org_context.organization
                handler()(integration, organization, event)
        return HttpResponse(status=204)
