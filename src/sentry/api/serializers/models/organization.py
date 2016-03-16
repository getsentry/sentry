from __future__ import absolute_import

from sentry.app import quotas
from sentry.api.serializers import Serializer, register, serialize
from sentry.auth import access
from sentry.models import (
    Organization,
    OrganizationAccessRequest,
    OrganizationOnboardingTask,
    OrganizationOption,
    Team,
    TeamStatus
)


@register(Organization)
class OrganizationSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': str(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'dateCreated': obj.date_added,
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
        if features.has('organizations:sso', obj, actor=user):
            feature_list.append('sso')
        if features.has('organizations:callsigns', obj, actor=user):
            feature_list.append('callsigns')
        if features.has('organizations:onboarding', obj, actor=user) and \
           not OrganizationOption.objects.filter(organization=obj).exists():
            feature_list.append('onboarding')

        if getattr(obj.flags, 'allow_joinleave'):
            feature_list.append('open-membership')
        if not getattr(obj.flags, 'disable_shared_issues'):
            feature_list.append('shared-issues')

        context = super(DetailedOrganizationSerializer, self).serialize(
            obj, attrs, user)
        context['quota'] = {
            'maxRate': quotas.get_organization_quota(obj),
            'projectLimit': int(OrganizationOption.objects.get_value(
                organization=obj,
                key='sentry:project-rate-limit',
                default=100,
            )),
        }
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
