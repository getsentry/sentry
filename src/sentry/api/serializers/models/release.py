from __future__ import absolute_import

import six

from django.db.models import Sum


from collections import Counter, defaultdict

from sentry.api.serializers import Serializer, register, serialize
from sentry.db.models.query import in_iexact
from sentry.models import Release, ReleaseCommit, ReleaseProject, TagValue, User, UserEmail


def get_users_for_commits(item_list):
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
    authors = set(c.author for c in item_list if c.author is not None)
    if not len(authors):
        return {}

    # Filter users based on the emails provided in the commits
    user_emails = UserEmail.objects.filter(
        in_iexact('email', [a.email for a in authors]),
    ).order_by('id')

    org_ids = set(item.organization_id for item in item_list)
    assert len(org_ids) == 1
    org_id = org_ids.pop()

    # Filter users belonging to the organization associated with
    # the release
    users = User.objects.filter(
        id__in=[ue.user_id for ue in user_emails],
        sentry_orgmember_set__organization_id=org_id
    )
    users = serialize(list(users))
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

    author_objs = {}
    for author in authors:
        author_objs[author.id] = users_by_email.get(author.email, {
            "name": author.name,
            "email": author.email
        })

    return author_objs


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
                'commit_count': 3,
                'authors': [<User id=1>, <User id=2>]
            },
            ...
        }

        If there are no commits, returns None.
        """

        release_commits = list(ReleaseCommit.objects.filter(
            release__in=item_list).select_related("commit", "commit__author"))

        if not len(release_commits):
            return None

        users_by_email = get_users_for_commits([rc.commit for rc in release_commits])
        commit_count_by_release_id = Counter()
        authors_by_release_id = defaultdict(dict)
        latest_commit_by_release_id = {}

        # it's possible to have duplicate users in users_by_email
        # when CommitAuthor objects are different
        # but emails are associated to the same user, so
        # this is to prevent duplicate users from being returned
        authors_seen_in_release = defaultdict(set)

        for rc in release_commits:
            # Accumulate authors per release
            author = rc.commit.author

            if author:
                author_user = users_by_email[author.id]
                if author_user.get('id') and author_user['id'] in authors_seen_in_release[rc.release_id]:
                    pass
                else:
                    authors_by_release_id[rc.release_id][author.id] = \
                        users_by_email[author.id]
                author_user.get('id') and authors_seen_in_release[rc.release_id].add(author_user['id'])

            # Increment commit count per release
            commit_count_by_release_id[rc.release_id] += 1

            # look for latest commit by release
            # lower order means newer commit
            if rc.release_id not in latest_commit_by_release_id \
                    or latest_commit_by_release_id[rc.release_id].order > rc.order:
                latest_commit_by_release_id[rc.release_id] = rc

        result = {}
        for item in item_list:
            last_commit = latest_commit_by_release_id.get(item.id)
            result[item] = {
                'commit_count': commit_count_by_release_id[item.id],
                'authors': authors_by_release_id.get(item.id, {}).values(),
                'last_commit': serialize(last_commit.commit) if last_commit is not None else None,
            }
        return result

    def get_attrs(self, item_list, user, *args, **kwargs):
        project = kwargs.get('project')
        if project:
            project_ids = [project.id]
        else:
            project_ids = ReleaseProject.objects.filter(
                release__in=item_list
            ).values_list('project_id', flat=True)

        tags = {}
        tks = TagValue.objects.filter(
            project_id__in=project_ids,
            key='sentry:release',
            value__in=[o.version for o in item_list],
        )
        for tk in tks:
            val = tags.get(tk.value)
            tags[tk.value] = {
                'first_seen': min(tk.first_seen, val['first_seen']) if val else tk.first_seen,
                'last_seen': max(tk.last_seen, val['last_seen']) if val else tk.last_seen
            }
        owners = {
            d['id']: d
            for d in serialize(set(i.owner for i in item_list if i.owner_id), user)
        }

        if project:
            group_counts_by_release = dict(ReleaseProject.objects.filter(
                project=project,
                release__in=item_list
            ).values_list('release_id', 'new_groups'))
        else:
            # assume it should be a sum across release
            # if no particular project specified
            group_counts_by_release = dict(
                ReleaseProject.objects.filter(release__in=item_list, new_groups__isnull=False)
                                      .values('release_id')
                                      .annotate(new_groups=Sum('new_groups'))
                                      .values_list('release_id', 'new_groups')
            )

        release_metadata_attrs = self._get_commit_metadata(item_list, user)

        release_projects = defaultdict(list)
        project_releases = ReleaseProject.objects.filter(
            release__in=item_list
        ).values('release_id', 'project__slug', 'project__name')
        for pr in project_releases:
            release_projects[pr['release_id']].append({
                'slug': pr['project__slug'],
                'name': pr['project__name'],
            })
        result = {}
        for item in item_list:
            result[item] = {
                'tag': tags.get(item.version),
                'owner': owners[six.text_type(item.owner_id)] if item.owner_id else None,
                'new_groups': group_counts_by_release.get(item.id) or 0,
                'commit_count': 0,
                'authors': [],
                'projects': release_projects.get(item.id, [])
            }
            if release_metadata_attrs:
                result[item].update(release_metadata_attrs[item])

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
            'commitCount': attrs.get('commit_count', 0),
            'lastCommit': attrs.get('last_commit'),
            'authors': attrs.get('authors', []),
            'projects': attrs.get('projects', [])
        }
        if attrs['tag']:
            d.update({
                'lastEvent': attrs['tag']['last_seen'],
                'firstEvent': attrs['tag']['first_seen'],
            })
        else:
            d.update({
                'lastEvent': None,
                'firstEvent': None,
            })
        return d
