from __future__ import absolute_import

import six

from django.db.models import Sum


from collections import Counter, defaultdict

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import Release, ReleaseCommit, ReleaseProject, TagValue, User


@register(Release)
class ReleaseSerializer(Serializer):
    # O(a b c)

    # for every release
    #      for every release commit
    #            for every author
    # def _get_commit_authors(self, item_list, user):
    #     # TODO: feature switch

    #     # for each release in item_list
    #     # do a subquery and get their authors
    #     # add authors to that item_list entry
    #     releasecommits = ReleaseCommit.objects.filter(
    #         release=item
    #     ).select_related("commit")
    #     authors = []
    #     for releasecommit in releasecommits:
    #         author = releasecommit.commit.author
    #         try:
    #             author = User.objects.get(email=author.email)
    #         except MultipleObjectsReturned:
    #             author = User.objects.filter(email=author.email).first()
    #         except ObjectDoesNotExist:
    #             pass
    #         authors.append(serialize(author))

    #     return authors
    def _get_commit_metadata(self, item_list, user):
        release_commits = list(ReleaseCommit.objects.filter(
            release__in=item_list).prefetch_related("commit__author"))

        commit_count_by_release_id = Counter()
        authors_by_release_id = defaultdict(dict)

        author_emails = set(rc.commit.author.email for rc in release_commits)

        # TODO: Consider UserEmail models, organization filter
        # NOTE: Possible to return multiple User objects for a single email
        users = list(User.objects.filter(email__in=author_emails))
        users_by_email = {}
        for user in users:
            # Duplicates will clobber existing record in dict
            users_by_email[user.email] = serialize(user)

        for rc in release_commits:
            # Count commits per release
            commit_count_by_release_id[rc.release_id] += 1

            # Accumulate authors per release
            release_authors = authors_by_release_id[rc.release_id]
            if rc.commit.author_id not in release_authors:
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
                'authors': authors_by_release_id[item.id].values(),
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
            }
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
            'commitCount': attrs['commit_count'],
            'authors': attrs['authors'],
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
