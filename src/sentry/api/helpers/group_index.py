from __future__ import absolute_import

from rest_framework import serializers

from sentry.api.fields import ActorField
from sentry.constants import DEFAULT_SORT_OPTION
from sentry.models import Commit, Group, GroupStatus, Release, Repository, Team, User
from sentry.models.group import looks_like_short_id
from sentry.search.utils import InvalidQuery, parse_query
from sentry.utils.cursors import Cursor


class ValidationError(Exception):
    pass


def build_query_params_from_request(request, projects):
    query_kwargs = {
        'projects': projects,
        'sort_by': request.GET.get('sort', DEFAULT_SORT_OPTION),
    }

    limit = request.GET.get('limit')
    if limit:
        try:
            query_kwargs['limit'] = int(limit)
        except ValueError:
            raise ValidationError('invalid limit')

    # TODO: proper pagination support
    cursor = request.GET.get('cursor')
    if cursor:
        query_kwargs['cursor'] = Cursor.from_string(cursor)

    query = request.GET.get('query', 'is:unresolved').strip()
    if query:
        try:
            query_kwargs.update(parse_query(projects, query, request.user))
        except InvalidQuery as e:
            raise ValidationError(
                u'Your search query could not be parsed: {}'.format(
                    e.message)
            )

    return query_kwargs


def get_by_short_id(organization_id, is_short_id_lookup, query):
    if is_short_id_lookup == '1' and \
            looks_like_short_id(query):
        try:
            return Group.objects.by_qualified_short_id(
                organization_id, query
            )
        except Group.DoesNotExist:
            pass


STATUS_CHOICES = {
    'resolved': GroupStatus.RESOLVED,
    'unresolved': GroupStatus.UNRESOLVED,
    'ignored': GroupStatus.IGNORED,
    'resolvedInNextRelease': GroupStatus.UNRESOLVED,

    # TODO(dcramer): remove in 9.0
    'muted': GroupStatus.IGNORED,
}


class InCommitValidator(serializers.Serializer):
    commit = serializers.CharField(required=True)
    repository = serializers.CharField(required=True)

    def validate_repository(self, attrs, source):
        value = attrs[source]
        project = self.context['project']
        try:
            attrs[source] = Repository.objects.get(
                organization_id=project.organization_id,
                name=value,
            )
        except Repository.DoesNotExist:
            raise serializers.ValidationError(
                'Unable to find the given repository.'
            )
        return attrs

    def validate(self, attrs):
        attrs = super(InCommitValidator, self).validate(attrs)
        repository = attrs.get('repository')
        commit = attrs.get('commit')
        if not repository:
            raise serializers.ValidationError({
                'repository': ['Unable to find the given repository.'],
            })
        if not commit:
            raise serializers.ValidationError({
                'commit': ['Unable to find the given commit.'],
            })
        try:
            commit = Commit.objects.get(
                repository_id=repository.id,
                key=commit,
            )
        except Commit.DoesNotExist:
            raise serializers.ValidationError({
                'commit': ['Unable to find the given commit.'],
            })
        return commit


class StatusDetailsValidator(serializers.Serializer):
    inNextRelease = serializers.BooleanField()
    inRelease = serializers.CharField()
    inCommit = InCommitValidator(required=False)
    ignoreDuration = serializers.IntegerField()
    ignoreCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreWindow = serializers.IntegerField(max_value=7 * 24 * 60)
    ignoreUserCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreUserWindow = serializers.IntegerField(max_value=7 * 24 * 60)

    def validate_inRelease(self, attrs, source):
        value = attrs[source]
        project = self.context['project']
        if value == 'latest':
            try:
                attrs[source] = Release.objects.filter(
                    projects=project,
                    organization_id=project.organization_id,
                ).extra(select={
                    'sort': 'COALESCE(date_released, date_added)',
                }).order_by('-sort')[0]
            except IndexError:
                raise serializers.ValidationError(
                    'No release data present in the system to form a basis for \'Next Release\''
                )
        else:
            try:
                attrs[source] = Release.objects.get(
                    projects=project,
                    organization_id=project.organization_id,
                    version=value,
                )
            except Release.DoesNotExist:
                raise serializers.ValidationError(
                    'Unable to find a release with the given version.'
                )
        return attrs

    def validate_inNextRelease(self, attrs, source):
        project = self.context['project']
        try:
            attrs[source] = Release.objects.filter(
                projects=project,
                organization_id=project.organization_id,
            ).extra(select={
                'sort': 'COALESCE(date_released, date_added)',
            }).order_by('-sort')[0]
        except IndexError:
            raise serializers.ValidationError(
                'No release data present in the system to form a basis for \'Next Release\''
            )
        return attrs


class GroupValidator(serializers.Serializer):
    status = serializers.ChoiceField(choices=zip(
        STATUS_CHOICES.keys(), STATUS_CHOICES.keys()))
    statusDetails = StatusDetailsValidator()
    hasSeen = serializers.BooleanField()
    isBookmarked = serializers.BooleanField()
    isPublic = serializers.BooleanField()
    isSubscribed = serializers.BooleanField()
    merge = serializers.BooleanField()
    discard = serializers.BooleanField()
    ignoreDuration = serializers.IntegerField()
    ignoreCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreWindow = serializers.IntegerField(max_value=7 * 24 * 60)
    ignoreUserCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreUserWindow = serializers.IntegerField(max_value=7 * 24 * 60)
    assignedTo = ActorField()

    # TODO(dcramer): remove in 9.0
    snoozeDuration = serializers.IntegerField()

    def validate_assignedTo(self, attrs, source):
        value = attrs[source]
        if value and value.type is User and not self.context['project'].member_set.filter(
                user_id=value.id).exists():
            raise serializers.ValidationError(
                'Cannot assign to non-team member')

        if value and value.type is Team and not self.context['project'].teams.filter(
                id=value.id).exists():
            raise serializers.ValidationError(
                'Cannot assign to a team without access to the project')

        return attrs

    def validate(self, attrs):
        attrs = super(GroupValidator, self).validate(attrs)
        if len(attrs) > 1 and 'discard' in attrs:
            raise serializers.ValidationError(
                'Other attributes cannot be updated when discarding')
        return attrs
