from __future__ import absolute_import

import six

from django.db.models import Sum

from django.core.exceptions import ObjectDoesNotExist, MultipleObjectsReturned
from sentry.api.serializers import Serializer, register, serialize
from sentry.models import Release, ReleaseCommit, ReleaseProject, TagValue, User


@register(Release)
class ReleaseSerializer(Serializer):
    def _get_commit_authors(self, item, user):
        # TODO: feature switch

        # for each release in item_list
        # do a subquery and get their authors
        # add authors to that item_list entry
        releasecommits = ReleaseCommit.objects.filter(
            release=item
        ).select_related("commit")
        authors = []
        for releasecommit in releasecommits:
            author = releasecommit.commit.author
            try:
                author = User.objects.get(email=author.email)
            except MultipleObjectsReturned:
                author = User.objects.filter(email=author.email).first()
            except ObjectDoesNotExist:
                pass
            authors.append(serialize(author))

        return authors

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

        result = {}
        # if features.has('organizations:release-commits', actor=user):
        # numCommits
        # get number of subcommits
        # num_commits = ReleaseCommit.objects.count(release_id=release.id)
        for item in item_list:
            authors = self._get_commit_authors(item, user)
            result[item] = {
                'authors': authors,
                'author_count': len(authors),
                'commit_count': ReleaseCommit.objects.filter(release=item).count(),
                'tag': tags.get(item.version),
                'owner': owners[six.text_type(item.owner_id)] if item.owner_id else None,
                'new_groups': group_counts_by_release.get(item.id) or 0
            }
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
            'authorCount': attrs['author_count'],
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
