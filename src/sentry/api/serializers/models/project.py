from __future__ import absolute_import

from django.db.models import Q

from sentry.api.serializers import register, serialize, Serializer
from sentry.models import (
    Project, ProjectBookmark, ProjectOption, ProjectStatus, UserOption
)

STATUS_LABELS = {
    ProjectStatus.VISIBLE: 'active',
    ProjectStatus.HIDDEN: 'deleted',
    ProjectStatus.PENDING_DELETION: 'deleted',
    ProjectStatus.DELETION_IN_PROGRESS: 'deleted',
}


@register(Project)
class ProjectSerializer(Serializer):
    def get_attrs(self, item_list, user):
        if user.is_authenticated() and item_list:
            bookmarks = set(ProjectBookmark.objects.filter(
                user=user,
                project_id__in=[i.id for i in item_list],
            ).values_list('project_id', flat=True))
            user_options = {
                (u.project_id, u.key): u.value
                for u in UserOption.objects.filter(
                    Q(user=user, project__in=item_list, key='mail:alert') |
                    Q(user=user, key='subscribe_by_default', project__isnull=True)
                )
            }
            default_subscribe = int(user_options.get('subscribe_by_default', 1))
        else:
            bookmarks = set()
            user_options = {}
            default_subscribe = False

        reviewed_callsigns = {
            p.project_id: p.value
            for p in ProjectOption.objects.filter(
                project__in=item_list,
                key='sentry:reviewed-callsign',
            )
        }

        result = {}
        for item in item_list:
            result[item] = {
                'is_bookmarked': item.id in bookmarks,
                'is_subscribed': bool(user_options.get(
                    (item.id, 'mail:alert'),
                    default_subscribe,
                )),
                'reviewed-callsign': reviewed_callsigns.get(item.id),
            }
        return result

    def serialize(self, obj, attrs, user):
        from sentry import features

        feature_list = []
        for feature in ('breadcrumbs', 'global-events'):
            if features.has('projects:' + feature, obj, actor=user):
                feature_list.append(feature)

        status_label = STATUS_LABELS.get(obj.status, 'unknown')

        return {
            'id': str(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'isPublic': obj.public,
            'isBookmarked': attrs['is_bookmarked'],
            'callSign': obj.callsign,
            'color': obj.color,
            # TODO(mitsuhiko): eventually remove this when we will treat
            # all short names as reviewed.
            'callSignReviewed': bool(attrs['reviewed-callsign']),
            'dateCreated': obj.date_added,
            'firstEvent': obj.first_event,
            'features': feature_list,
            'status': status_label,
        }


class ProjectWithOrganizationSerializer(ProjectSerializer):
    def get_attrs(self, item_list, user):
        attrs = super(ProjectWithOrganizationSerializer, self).get_attrs(
            item_list, user
        )

        orgs = {
            d['id']: d
            for d in serialize(list(set(i.organization for i in item_list)), user)
        }
        for item in item_list:
            attrs[item]['organization'] = orgs[str(item.organization_id)]
        return attrs

    def serialize(self, obj, attrs, user):
        data = super(ProjectWithOrganizationSerializer, self).serialize(
            obj, attrs, user
        )
        data['organization'] = attrs['organization']
        return data


class SharedProjectSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        from sentry import features

        feature_list = []
        for feature in ('global-events',):
            if features.has('projects:' + feature, obj, actor=user):
                feature_list.append(feature)

        return {
            'slug': obj.slug,
            'name': obj.name,
            'callSign': obj.callsign,
            'color': obj.color,
            'features': feature_list,
            'organization': {
                'slug': obj.organization.slug,
                'name': obj.organization.name,
            },
        }
