from django.db import IntegrityError
from django.http import Http404

from sentry.models import CommitAuthor, PullRequest, Repository, User

from . import Webhook, get_external_id


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
        # The value of the merge_commit_sha attribute changes depending on the
        # state of the pull request. Before a pull request is merged, the
        # merge_commit_sha attribute holds the SHA of the test merge commit.
        # After a pull request is merged, the attribute changes depending on how
        # the pull request was merged:
        # - If the pull request was merged as a merge commit, the attribute
        #   represents the SHA of the merge commit.
        # - If the pull request was merged via a squash, the attribute
        #   represents the SHA of the squashed commit on the base branch.
        # - If the pull request was rebased, the attribute represents the commit
        #   that the base branch was updated to.
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
