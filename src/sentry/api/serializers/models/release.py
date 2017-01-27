from __future__ import absolute_import

import six

from django.db.models import Sum


from collections import Counter, defaultdict

from sentry.api.serializers import Serializer, register, serialize
from sentry.db.models.query import in_iexact
from sentry.models import Release, ReleaseCommit, ReleaseProject, TagValue, User, UserEmail


def get_users_for_commits(item_list):

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
    users_by_id = dict((user.id, serialize(user)) for user in users)

    # Figure out which email address matches to a user
    users_by_email = {}
    for email in user_emails:
        if email.email in users_by_email:
            pass
        user = users_by_id.get(email.user_id)
        users_by_email[email.email] = user

    author_objs = {}
    for author in authors:
        author_objs[author.email] = users_by_email.get(author.email, {
            "name": author.name,
            "email": author.email
        })

    return author_objs


@register(Release)
class ReleaseSerializer(Serializer):
    def _get_users_for_commits(self, release_commits, org_id):
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
        authors = set(rc.commit.author for rc in release_commits if rc.commit.author is not None)
        if not len(authors):
            return {}

        # Filter users based on the emails provided in the commits
        user_emails = UserEmail.objects.filter(
            in_iexact('email', [a.email for a in authors]),
        ).order_by('id')

        # Filter users belonging to the organization associated with
        # the release
        users = User.objects.filter(
            id__in=[ue.user_id for ue in user_emails],
            sentry_orgmember_set__organization_id=org_id
        )
        users_by_id = dict((user.id, serialize(user)) for user in users)

        # Figure out which email address matches to a user
        users_by_email = {}
        for user_email in user_emails:
            if user_email.email in users_by_email:
                pass

            user = users_by_id.get(user_email.user_id)
            if user:
                users_by_email[user_email.email] = user

        author_objs = {}
        for author in authors:
            author_objs[author.id] = users_by_email.get(author.email, {
                "name": author.name,
                "email": author.email
            })

        return author_objs

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

        org_ids = set(item.organization_id for item in item_list)
        assert len(org_ids) == 1
        org_id = org_ids.pop()

        users_by_email = self._get_users_for_commits(release_commits, org_id)
        commit_count_by_release_id = Counter()
        authors_by_release_id = defaultdict(dict)

        for rc in release_commits:
            # Accumulate authors per release
            author = rc.commit.author
            if author:
                authors_by_release_id[rc.release_id][author.id] = \
                    users_by_email[author.id]

            # Increment commit count per release
            commit_count_by_release_id[rc.release_id] += 1

        result = {}
        for item in item_list:
            result[item] = {
                'commit_count': commit_count_by_release_id[item.id],
                'authors': authors_by_release_id.get(item.id, {}).values(),
            }
        return result

    def get_attrs(self, item_list, user, *args, **kwargs):
        tags = {
            tk.value: tk
            for tk in TagValue.objects.filter(
                project_id__in=ReleaseProject.objects.filter(
                    release__in=item_list
                ).values_list('project_id', flat=True),
                key='sentry:release',
                value__in=[o.version for o in item_list],
            )
        }
        owners = {
            d['id']: d
            for d in serialize(set(i.owner for i in item_list if i.owner_id), user)
        }

        if kwargs.get('project'):
            group_counts_by_release = dict(ReleaseProject.objects.filter(
                project=kwargs.get('project'),
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

        result = {}
        for item in item_list:
            result[item] = {
                'tag': tags.get(item.version),
                'owner': owners[six.text_type(item.owner_id)] if item.owner_id else None,
                'new_groups': group_counts_by_release.get(item.id) or 0,
                'commit_count': 0,
                'authors': [],
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
            'dateStarted': obj.date_started,
            'dateReleased': obj.date_released,
            'dateCreated': obj.date_added,
            'data': obj.data,
            'newGroups': attrs['new_groups'],
            'owner': attrs['owner'],
            'commitCount': attrs.get('commit_count', 0),
            'authors': attrs.get('authors', []),
        }
        if attrs['tag']:
            d.update({
                'lastEvent': attrs['tag'].last_seen,
                'firstEvent': attrs['tag'].first_seen,
            })
        else:
            d.update({
                'lastEvent': None,
                'firstEvent': None,
            })
        return d
