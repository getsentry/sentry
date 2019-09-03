from __future__ import absolute_import

import six

from collections import defaultdict
from django.db.models import Sum
from itertools import izip

from sentry import tagstore
from sentry.api.serializers import Serializer, register, serialize
from sentry.db.models.query import in_iexact
from sentry.models import (
    Commit,
    CommitAuthor,
    Deploy,
    Release,
    ReleaseProject,
    ReleaseProjectEnvironment,
    User,
    UserEmail,
)


def get_users_for_authors(organization_id, authors, user=None):
    """
    Returns a dictionary of author_id => user, if a Sentry
    user object exists for that email. If there is no matching
    Sentry user, a {user, email} dict representation of that
    author is returned.
    e.g.
    {
        1: serialized(<User id=1>),
        2: {email: 'not-a-user@example.com', name: 'dunno'},
        ...
    }
    """
    # Filter users based on the emails provided in the commits
    user_emails = list(
        UserEmail.objects.filter(in_iexact("email", [a.email for a in authors])).order_by("id")
    )

    # Filter users belonging to the organization associated with
    # the release
    users = User.objects.filter(
        id__in={ue.user_id for ue in user_emails},
        is_active=True,
        sentry_orgmember_set__organization_id=organization_id,
    )
    users = serialize(list(users), user)
    users_by_id = {user["id"]: user for user in users}

    # Figure out which email address matches to a user
    users_by_email = {}
    for email in user_emails:
        if email.email not in users_by_email:
            user = users_by_id.get(six.text_type(email.user_id), None)
            # user can be None if there's a user associated
            # with user_email in separate organization
            if user:
                users_by_email[email.email] = user

    results = {}
    for author in authors:
        results[six.text_type(author.id)] = users_by_email.get(
            author.email, {"name": author.name, "email": author.email}
        )

    return results


@register(Release)
class ReleaseSerializer(Serializer):
    def _get_commit_metadata(self, item_list, user):
        """
        Returns a dictionary of release_id => commit metadata,
        where each commit metadata dict contains commit_count
        and an array of authors.
        e.g.
        {
            1: {
                'latest_commit': <Commit id=1>,
                'authors': [<User id=1>, <User id=2>]
            },
            ...
        }
        """
        author_ids = set()
        for obj in item_list:
            author_ids.update(obj.authors)

        if author_ids:
            authors = list(CommitAuthor.objects.filter(id__in=author_ids))
        else:
            authors = []

        if authors:
            org_ids = set(item.organization_id for item in item_list)
            if len(org_ids) != 1:
                users_by_author = {}
            else:
                users_by_author = get_users_for_authors(
                    organization_id=org_ids.pop(), authors=authors, user=user
                )
        else:
            users_by_author = {}

        commit_ids = set((o.last_commit_id for o in item_list if o.last_commit_id))
        if commit_ids:
            commit_list = list(Commit.objects.filter(id__in=commit_ids).select_related("author"))
            commits = {c.id: d for c, d in izip(commit_list, serialize(commit_list, user))}
        else:
            commits = {}

        result = {}
        for item in item_list:
            item_authors = []
            seen_authors = set()
            for user in (users_by_author.get(a) for a in item.authors):
                if user and user["email"] not in seen_authors:
                    seen_authors.add(user["email"])
                    item_authors.append(user)

            result[item] = {
                "authors": item_authors,
                "last_commit": commits.get(item.last_commit_id),
            }
        return result

    def _get_deploy_metadata(self, item_list, user):
        """
        Returns a dictionary of release_id => commit metadata,
        where each commit metadata dict contains commit_count
        and an array of authors.
        e.g.
        {
            1: {
                'latest_commit': <Commit id=1>,
                'authors': [<User id=1>, <User id=2>]
            },
            ...
        }
        """
        deploy_ids = set((o.last_deploy_id for o in item_list if o.last_deploy_id))
        if deploy_ids:
            deploy_list = list(Deploy.objects.filter(id__in=deploy_ids))
            deploys = {d.id: c for d, c in izip(deploy_list, serialize(deploy_list, user))}
        else:
            deploys = {}

        result = {}
        for item in item_list:
            result[item] = {"last_deploy": deploys.get(item.last_deploy_id)}
        return result

    def __get_release_data_no_environment(self, project, item_list):
        if project is not None:
            project_ids = [project.id]
        else:
            project_ids = list(
                ReleaseProject.objects.filter(release__in=item_list)
                .values_list("project_id", flat=True)
                .distinct()
            )

        first_seen = {}
        last_seen = {}
        tvs = tagstore.get_release_tags(
            project_ids, environment_id=None, versions=[o.version for o in item_list]
        )
        for tv in tvs:
            first_val = first_seen.get(tv.value)
            last_val = last_seen.get(tv.value)
            first_seen[tv.value] = min(tv.first_seen, first_val) if first_val else tv.first_seen
            last_seen[tv.value] = max(tv.last_seen, last_val) if last_val else tv.last_seen

        if project is not None:
            group_counts_by_release = dict(
                ReleaseProject.objects.filter(project=project, release__in=item_list).values_list(
                    "release_id", "new_groups"
                )
            )
        else:
            # assume it should be a sum across release
            # if no particular project specified
            group_counts_by_release = dict(
                ReleaseProject.objects.filter(release__in=item_list, new_groups__isnull=False)
                .values("release_id")
                .annotate(new_groups=Sum("new_groups"))
                .values_list("release_id", "new_groups")
            )
        return first_seen, last_seen, group_counts_by_release

    def __get_release_data_with_environment(self, project, item_list, environment):
        release_project_envs = ReleaseProjectEnvironment.objects.filter(
            release__in=item_list, environment=environment
        ).select_related("release")
        if project is not None:
            release_project_envs = release_project_envs.filter(project=project)
        first_seen = {}
        last_seen = {}
        for release_project_env in release_project_envs:
            first_seen[release_project_env.release.version] = release_project_env.first_seen
            last_seen[release_project_env.release.version] = release_project_env.last_seen

        issue_counts_by_release = dict(
            release_project_envs.values("release_id")
            .annotate(new_issues_count=Sum("new_issues_count"))
            .values_list("release_id", "new_issues_count")
        )
        return first_seen, last_seen, issue_counts_by_release

    def get_attrs(self, item_list, user, **kwargs):
        project = kwargs.get("project")
        environment = kwargs.get("environment")
        if environment is None:
            first_seen, last_seen, issue_counts_by_release = self.__get_release_data_no_environment(
                project, item_list
            )
        else:
            first_seen, last_seen, issue_counts_by_release = self.__get_release_data_with_environment(
                project, item_list, environment
            )

        owners = {
            d["id"]: d for d in serialize(set(i.owner for i in item_list if i.owner_id), user)
        }

        release_metadata_attrs = self._get_commit_metadata(item_list, user)
        deploy_metadata_attrs = self._get_deploy_metadata(item_list, user)

        release_projects = defaultdict(list)
        project_releases = ReleaseProject.objects.filter(release__in=item_list).values(
            "release_id", "project__slug", "project__name"
        )
        for pr in project_releases:
            release_projects[pr["release_id"]].append(
                {"slug": pr["project__slug"], "name": pr["project__name"]}
            )

        result = {}
        for item in item_list:
            result[item] = {
                "owner": owners[six.text_type(item.owner_id)] if item.owner_id else None,
                "new_groups": issue_counts_by_release.get(item.id) or 0,
                "projects": release_projects.get(item.id, []),
                "first_seen": first_seen.get(item.version),
                "last_seen": last_seen.get(item.version),
            }
            result[item].update(release_metadata_attrs[item])
            result[item].update(deploy_metadata_attrs[item])
        return result

    def serialize(self, obj, attrs, user, **kwargs):
        d = {
            "version": obj.version,
            "shortVersion": obj.version,
            "ref": obj.ref,
            "url": obj.url,
            "dateReleased": obj.date_released,
            "dateCreated": obj.date_added,
            "data": obj.data,
            "newGroups": attrs["new_groups"],
            "owner": attrs["owner"],
            "commitCount": obj.commit_count,
            "lastCommit": attrs.get("last_commit"),
            "deployCount": obj.total_deploys,
            "lastDeploy": attrs.get("last_deploy"),
            "authors": attrs.get("authors", []),
            "projects": attrs.get("projects", []),
            "firstEvent": attrs.get("first_seen"),
            "lastEvent": attrs.get("last_seen"),
        }
        return d
