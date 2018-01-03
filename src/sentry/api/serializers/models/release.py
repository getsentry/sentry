from __future__ import absolute_import

import six

from collections import defaultdict
from django.db.models import Sum
from itertools import izip

from sentry import tagstore
from sentry.api.serializers import Serializer, register, serialize
from sentry.db.models.query import in_iexact
from sentry.models import (
    Commit, CommitAuthor, Deploy, Release, ReleaseProject, User, UserEmail
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
        UserEmail.objects.filter(
            in_iexact('email', [a.email for a in authors]),
        ).order_by('id')
    )

    # Filter users belonging to the organization associated with
    # the release
    users = User.objects.filter(
        id__in={ue.user_id for ue in user_emails},
        is_active=True,
        sentry_orgmember_set__organization_id=organization_id
    )
    users = serialize(list(users), user)
    users_by_id = {user['id']: user for user in users}

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
            author.email, {'name': author.name,
                           'email': author.email}
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
            authors = list(CommitAuthor.objects.filter(
                id__in=author_ids,
            ))
        else:
            authors = []

        if authors:
            org_ids = set(item.organization_id for item in item_list)
            if len(org_ids) != 1:
                users_by_author = {}
            else:
                users_by_author = get_users_for_authors(
                    organization_id=org_ids.pop(),
                    authors=authors,
                    user=user,
                )
        else:
            users_by_author = {}

        commit_ids = set((o.last_commit_id for o in item_list if o.last_commit_id))
        if commit_ids:
            commit_list = list(Commit.objects.filter(
                id__in=commit_ids,
            ).select_related('author'))
            commits = {c.id: d for c, d in izip(commit_list, serialize(commit_list, user))}
        else:
            commits = {}

        result = {}
        for item in item_list:
            item_authors = []
            seen_authors = set()
            for user in (users_by_author.get(a) for a in item.authors):
                if user and user['email'] not in seen_authors:
                    seen_authors.add(user['email'])
                    item_authors.append(user)

            result[item] = {
                'authors': item_authors,
                'last_commit': commits.get(item.last_commit_id),
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
            deploy_list = list(Deploy.objects.filter(
                id__in=deploy_ids,
            ))
            deploys = {d.id: c for d, c in izip(deploy_list, serialize(deploy_list, user))}
        else:
            deploys = {}

        result = {}
        for item in item_list:
            result[item] = {
                'last_deploy': deploys.get(item.last_deploy_id),
            }
        return result

    def get_attrs(self, item_list, user, *args, **kwargs):
        project = kwargs.get('project')
        if project:
            project_ids = [project.id]
        else:
            project_ids = list(ReleaseProject.objects.filter(release__in=item_list).values_list(
                'project_id', flat=True
            ).distinct())

        tags = {}
        tvs = tagstore.get_release_tags(project_ids,
                                        environment_id=None,
                                        versions=[o.version for o in item_list])
        for tv in tvs:
            val = tags.get(tv.value)
            tags[tv.value] = {
                'first_seen': min(tv.first_seen, val['first_seen']) if val else tv.first_seen,
                'last_seen': max(tv.last_seen, val['last_seen']) if val else tv.last_seen
            }
        owners = {
            d['id']: d for d in serialize(set(i.owner for i in item_list if i.owner_id), user)
        }

        if project:
            group_counts_by_release = dict(
                ReleaseProject.objects.filter(project=project, release__in=item_list)
                .values_list('release_id', 'new_groups')
            )
        else:
            # assume it should be a sum across release
            # if no particular project specified
            group_counts_by_release = dict(
                ReleaseProject.objects.filter(release__in=item_list, new_groups__isnull=False)
                .values('release_id').annotate(new_groups=Sum('new_groups'))
                .values_list('release_id', 'new_groups')
            )

        release_metadata_attrs = self._get_commit_metadata(item_list, user)
        deploy_metadata_attrs = self._get_deploy_metadata(item_list, user)

        release_projects = defaultdict(list)
        project_releases = ReleaseProject.objects.filter(release__in=item_list).values(
            'release_id', 'project__slug', 'project__name'
        )
        for pr in project_releases:
            release_projects[pr['release_id']].append(
                {
                    'slug': pr['project__slug'],
                    'name': pr['project__name'],
                }
            )

        result = {}
        for item in item_list:
            result[item] = {
                'tag': tags.get(item.version),
                'owner': owners[six.text_type(item.owner_id)] if item.owner_id else None,
                'new_groups': group_counts_by_release.get(item.id) or 0,
                'projects': release_projects.get(item.id, [])
            }
            result[item].update(release_metadata_attrs[item])
            result[item].update(deploy_metadata_attrs[item])
        return result

    def serialize(self, obj, attrs, user, *args, **kwargs):
        d = {
            'version': obj.version,
            'shortVersion': obj.short_version,
            'ref': obj.ref,
            'url': obj.url,
            'dateReleased': obj.date_released,
            'dateCreated': obj.date_added,
            'data': obj.data,
            'newGroups': attrs['new_groups'],
            'owner': attrs['owner'],
            'commitCount': obj.commit_count,
            'lastCommit': attrs.get('last_commit'),
            'deployCount': obj.total_deploys,
            'lastDeploy': attrs.get('last_deploy'),
            'authors': attrs.get('authors', []),
            'projects': attrs.get('projects', [])
        }
        if attrs['tag']:
            d.update(
                {
                    'lastEvent': attrs['tag']['last_seen'],
                    'firstEvent': attrs['tag']['first_seen'],
                }
            )
        else:
            d.update({
                'lastEvent': None,
                'firstEvent': None,
            })
        return d
