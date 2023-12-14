from __future__ import annotations

import logging
from datetime import timezone

from dateutil.parser import parse as parse_date
from django.db import IntegrityError, router, transaction
from django.http import Http404

from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.integrations.integration import Integration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.plugins.providers import RepositoryProvider
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.shared_integrations.exceptions import ApiError
from sentry_plugins.github.client import GithubPluginClient

from . import Webhook, get_external_id, is_anonymous_email

logger = logging.getLogger("sentry.webhooks")


class PushEventWebhook(Webhook):
    def _handle(self, event, organization_id, is_apps):
        authors = {}

        gh_username_cache: dict[str, str | None] = {}

        try:
            repo = Repository.objects.get(
                organization_id=organization_id,
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
                                external_id=external_id, organization_id=organization_id
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
                                with GithubPluginClient() as client:
                                    gh_user = client.request_no_auth("GET", f"/users/{gh_username}")
                            except ApiError as exc:
                                logger.exception(str(exc))
                            else:
                                # even if we can't find a user, set to none so we
                                # don't re-query
                                gh_username_cache[gh_username] = None
                                user = user_service.get_user_by_social_auth(
                                    organization_id=organization_id,
                                    provider="github",
                                    uid=gh_user["id"],
                                )
                                if user is not None:
                                    author_email = user.email
                                    gh_username_cache[gh_username] = author_email
                                    if commit_author is not None:
                                        try:
                                            with transaction.atomic(
                                                router.db_for_write(CommitAuthor)
                                            ):
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
                    organization_id=organization_id,
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
                        with transaction.atomic(router.db_for_write(CommitAuthor)):
                            author.update(**update_kwargs)
                    except IntegrityError:
                        pass
            else:
                author = authors[author_email]

            try:
                with transaction.atomic(router.db_for_write(Commit)):
                    c = Commit.objects.create(
                        repository_id=repo.id,
                        organization_id=organization_id,
                        key=commit["id"],
                        message=commit["message"],
                        author=author,
                        date_added=parse_date(commit["timestamp"]).astimezone(timezone.utc),
                    )
                    for fname in commit["added"]:
                        CommitFileChange.objects.create(
                            organization_id=organization_id, commit=c, filename=fname, type="A"
                        )
                    for fname in commit["removed"]:
                        CommitFileChange.objects.create(
                            organization_id=organization_id, commit=c, filename=fname, type="D"
                        )
                    for fname in commit["modified"]:
                        CommitFileChange.objects.create(
                            organization_id=organization_id, commit=c, filename=fname, type="M"
                        )
            except IntegrityError:
                pass

    # https://developer.github.com/v3/activity/events/types/#pushevent
    def __call__(self, event, organization: Organization | None = None):
        is_apps = "installation" in event
        if organization is None:
            if "installation" not in event:
                return

            integration = integration_service.get_integration(
                external_id=event["installation"]["id"], provider="github_apps"
            )
            if integration is None:
                raise Integration.DoesNotExist

            integration_orgs = integration_service.get_organization_integrations(
                integration_id=integration.id
            )

            organizations = [org.organization_id for org in integration_orgs]

        else:
            organizations = [organization.id]

        for org_id in organizations:
            self._handle(event, org_id, is_apps)
