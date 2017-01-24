from __future__ import absolute_import

import six

from django.db.models import Sum


from collections import Counter, defaultdict

from sentry.api.serializers import Serializer, register, serialize
from sentry.db.models.query import in_iexact
from sentry.models import Release, ReleaseCommit, ReleaseProject, TagValue, User


@register(Release)
class ReleaseSerializer(Serializer):
    def _get_users_for_commits(self, release_commits, org_id):
        """
        Returns a dictionary of author_email => user, if a Sentry
        user object exists for that email. If there is no matching
        user, no key/value pair in the dictionary is made.

        e.g.
        {
            'jane@example.com': <User id=1>,
            ...
        }
        """
        author_emails = {rc.commit.author.email for rc in release_commits if rc.commit.author is not None}
        if not len(author_emails):
            return {}

        # Filter users based on the emails provided in the commits
        # Filter those belonging to the organization associated with the release
        users = User.objects.filter(
            in_iexact('emails__email', author_emails),
            sentry_orgmember_set__organization_id=org_id
        ).distinct()

        # Which email resulted in this user?
        # NOTE: If two users have same secondary email, only
        #       one will be credited as the author in UI
        # TODO: fix 'emails.all()' subquery in loop
        users_by_email = {}
        for user in users:
            serialized_user = serialize(user)
            for email in user.emails.all():
                users_by_email[email.email] = serialized_user
        return users_by_email

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

        # TODO: change to select_related commit, author
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
            release_authors = authors_by_release_id[rc.release_id]

            # Increment commit count per release
            commit_count_by_release_id[rc.release_id] += 1

            if rc.commit.author and \
               rc.commit.author_id not in release_authors:

                author = rc.commit.author
                if author.email in users_by_email:
                    # Author has a matching Sentry user
                    release_authors[author.id] = users_by_email[author.email]
                else:
                    release_authors[author.id] = {
                        "name": author.name,
                        "email": author.email
                    }

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
                'new_groups': group_counts_by_release.get(item.id) or 0
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
