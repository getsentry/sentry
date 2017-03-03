from __future__ import absolute_import

import six

from sentry import roles
from sentry.app import quotas
from sentry.api.serializers import Serializer, register, serialize
from sentry.auth import access
from sentry.models import (
    ApiKey,
    Organization,
    OrganizationAccessRequest,
    OrganizationAvatar,
    OrganizationOnboardingTask,
    OrganizationOption,
    Team,
    TeamStatus
)


@register(Organization)
class OrganizationSerializer(Serializer):
    def get_attrs(self, item_list, user):
        avatars = {
            a.organization_id: a
            for a in OrganizationAvatar.objects.filter(
                organization__in=item_list
            )
        }
        data = {}
        for item in item_list:
            data[item] = {
                'avatar': avatars.get(item.id),
            }
        return data

    def serialize(self, obj, attrs, user):
        if attrs.get('avatar'):
            avatar = {
                'avatarType': attrs['avatar'].get_avatar_type_display(),
                'avatarUuid': attrs['avatar'].ident if attrs['avatar'].file else None
            }
        else:
            avatar = {
                'avatarType': 'letter_avatar',
                'avatarUuid': None,
            }

        return {
            'id': six.text_type(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'dateCreated': obj.date_added,
            'isEarlyAdopter': bool(obj.flags.early_adopter),
            'avatar': avatar,
        }


class OnboardingTasksSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'task': obj.task,
            'status': dict(OrganizationOnboardingTask.STATUS_CHOICES).get(obj.status).lower(),
            'user': obj.user.name if obj.user else None,
            'dateCompleted': obj.date_completed,
            'data': obj.data,
        }


class DetailedOrganizationSerializer(OrganizationSerializer):
    def serialize(self, obj, attrs, user):
        from sentry import features
        from sentry.app import env
        from sentry.api.serializers.models.team import TeamWithProjectsSerializer

        team_list = list(Team.objects.filter(
            organization=obj,
            status=TeamStatus.VISIBLE,
        ))
        for team in team_list:
            team._organization_cache = obj

        onboarding_tasks = list(OrganizationOnboardingTask.objects.filter(
            organization=obj,
        ).select_related('user'))

        feature_list = []
        if features.has('organizations:repos', obj, actor=user):
            feature_list.append('repos')
        if features.has('organizations:sso', obj, actor=user):
            feature_list.append('sso')
        if features.has('organizations:callsigns', obj, actor=user):
            feature_list.append('callsigns')
        if features.has('organizations:onboarding', obj, actor=user) and \
                not OrganizationOption.objects.filter(organization=obj).exists():
            feature_list.append('onboarding')
        if features.has('organizations:api-keys', obj, actor=user) or \
                ApiKey.objects.filter(organization=obj).exists():
            feature_list.append('api-keys')
        if features.has('organizations:release-commits', obj, actor=user):
            feature_list.append('release-commits')

        if getattr(obj.flags, 'allow_joinleave'):
            feature_list.append('open-membership')
        if not getattr(obj.flags, 'disable_shared_issues'):
            feature_list.append('shared-issues')

        context = super(DetailedOrganizationSerializer, self).serialize(
            obj, attrs, user)
        max_rate = quotas.get_maximum_quota(obj)
        context['quota'] = {
            'maxRate': max_rate[0],
            'maxRateInterval': max_rate[1],
            'accountLimit': int(OrganizationOption.objects.get_value(
                organization=obj,
                key='sentry:account-rate-limit',
                default=0,
            )),
            'projectLimit': int(OrganizationOption.objects.get_value(
                organization=obj,
                key='sentry:project-rate-limit',
                default=100,
            )),
        }
        context.update({
            'isDefault': obj.is_default,
            'defaultRole': obj.default_role,
            'availableRoles': [{
                'id': r.id,
                'name': r.name,
            } for r in roles.get_all()],
            'openMembership': bool(obj.flags.allow_joinleave),
            'allowSharedIssues': not obj.flags.disable_shared_issues,
            'enhancedPrivacy': bool(obj.flags.enhanced_privacy),
            'dataScrubber': bool(obj.get_option('sentry:require_scrub_data', False)),
            'dataScrubberDefaults': bool(obj.get_option('sentry:require_scrub_defaults', False)),
            'sensitiveFields': obj.get_option('sentry:sensitive_fields', None) or [],
            'safeFields': obj.get_option('sentry:safe_fields', None) or [],
            'scrubIPAddresses': bool(obj.get_option('sentry:require_scrub_ip_address', False)),
        })
        context['teams'] = serialize(
            team_list, user, TeamWithProjectsSerializer())
        if env.request:
            context['access'] = access.from_request(env.request, obj).scopes
        else:
            context['access'] = access.from_user(user, obj).scopes
        context['features'] = feature_list
        context['pendingAccessRequests'] = OrganizationAccessRequest.objects.filter(
            team__organization=obj,
        ).count()
        context['onboardingTasks'] = serialize(onboarding_tasks, user, OnboardingTasksSerializer())
        return context
