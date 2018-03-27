from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response
from django.utils import timezone

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import ProjectOwnership, ProjectTeam, OrganizationMemberTeam, UserEmail
from sentry.ownership.grammar import parse_rules, dump_schema, ParseError


class ProjectOwnershipSerializer(serializers.Serializer):
    raw = serializers.CharField()
    fallthrough = serializers.BooleanField()

    def validate_raw(self, attrs, source):
        if not attrs[source].strip():
            return attrs
        try:
            rules = parse_rules(attrs[source])
        except ParseError as e:
            raise serializers.ValidationError(
                u'Parse error: %r (line %d, column %d)' % (
                    e.expr.name, e.line(), e.column()
                ))

        schema = dump_schema(rules)

        user_emails = []
        team_slugs = []
        for rule in schema['rules']:
            for owner in rule['owners']:
                if owner['type'] is 'user':
                    user_emails.append(owner['identifier'])

                if owner['type'] is 'team':
                    team_slugs.append(owner['identifier'])

        user_ids = UserEmail.objects.filter(
            email__in=user_emails
        ).values_list('user_id', flat=True)

        teams = ProjectTeam.objects.filter(
            project_id=self.context['ownership'].project_id
        ).values_list('team', flat=True)

        org_member_user_ids = OrganizationMemberTeam.objects.filter(
            organizationmember__user_id__in=user_ids,
            team__in=teams
        ).values_list('organizationmember__user_id', flat=True)

        validated_user_emails = set(UserEmail.objects.filter(
            user_id__in=org_member_user_ids
        ).values_list("email", flat=True))

        unfound_emails = set(user_emails).difference(validated_user_emails)

        validated_team_slugs = set(ProjectTeam.objects.filter(
            team__slug__in=team_slugs,
            project_id=self.context['ownership'].project_id
        ).values_list('team__slug', flat=True))

        unfound_teams = set(team_slugs).difference(validated_team_slugs)

        unfound_actors = list(unfound_emails) + \
            [u'#{}'.format(team) for team in list(unfound_teams)]

        if len(unfound_actors) > 0:
            raise serializers.ValidationError(
                u'Invalid rule owners: {}'.format(", ".join(unfound_actors))
            )

        attrs['schema'] = schema
        return attrs

    def save(self):
        ownership = self.context['ownership']

        changed = False
        if 'raw' in self.object:
            raw = self.object['raw']
            if not raw.strip():
                raw = None

            if ownership.raw != raw:
                ownership.raw = raw
                ownership.schema = self.object.get('schema')
                changed = True

        if 'fallthrough' in self.object:
            fallthrough = self.object['fallthrough']
            if ownership.fallthrough != fallthrough:
                ownership.fallthrough = fallthrough
                changed = True

        if changed:
            now = timezone.now()
            if ownership.date_created is None:
                ownership.date_created = now
            ownership.last_updated = now
            ownership.save()

        return ownership


class ProjectOwnershipEndpoint(ProjectEndpoint):
    def get_ownership(self, project):
        try:
            return ProjectOwnership.objects.get(project=project)
        except ProjectOwnership.DoesNotExist:
            return ProjectOwnership(
                project=project,
                date_created=None,
                last_updated=None,
            )

    def get(self, request, project):
        """
        Retrieve a Project's Ownership configuration
        ````````````````````````````````````````````

        Return details on a project's ownership configuration.

        :auth: required
        """
        return Response(serialize(self.get_ownership(project), request.user))

    def put(self, request, project):
        """
        Update a Project's Ownership configuration
        ``````````````````````````````````````````

        Updates a project's ownership configuration settings. Only the
        attributes submitted are modified.

        :param string raw: Raw input for ownership configuration.
        :param boolean fallthrough: Indicate if there is no match on explicit rules,
                                    to fall through and make everyone an implicit owner.
        :auth: required
        """
        serializer = ProjectOwnershipSerializer(
            data=request.DATA,
            partial=True,
            context={'ownership': self.get_ownership(project)}
        )
        if serializer.is_valid():
            ownership = serializer.save()
            return Response(serialize(ownership, request.user))
        return Response(serializer.errors, status=400)
