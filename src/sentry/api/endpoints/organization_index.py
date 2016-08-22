from __future__ import absolute_import

import six

from django.db import IntegrityError, transaction
from django.db.models import Count, Q, Sum
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry import roles
from sentry.api.base import DocSection, Endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.paginator import DateTimePaginator, OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import (
    AuditLogEntryEvent, Organization, OrganizationMember, OrganizationStatus,
    ProjectPlatform
)
from sentry.search.utils import tokenize_query, in_iexact
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('ListYourOrganizations')
def list_your_organizations_scenario(runner):
    runner.request(
        method='GET',
        path='/organizations/'
    )


class OrganizationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=True)
    slug = serializers.RegexField(r'^[a-z0-9_\-]+$', max_length=50,
                                  required=False)


class OrganizationIndexEndpoint(Endpoint):
    doc_section = DocSection.ORGANIZATIONS
    permission_classes = (OrganizationPermission,)

    @attach_scenarios([list_your_organizations_scenario])
    def get(self, request):
        """
        List your Organizations
        ```````````````````````

        Return a list of organizations available to the authenticated
        session.  This is particularly useful for requests with an
        user bound context.  For API key based requests this will
        only return the organization that belongs to the key.

        :qparam bool member: restrict results to organizations which you have
                             membership

        :auth: required
        """
        member_only = request.GET.get('member') in ('1', 'true')

        queryset = Organization.objects.filter(
            status=OrganizationStatus.VISIBLE,
        )

        if request.auth and not request.user.is_authenticated():
            if hasattr(request.auth, 'project'):
                queryset = queryset.filter(
                    id=request.auth.project.organization_id
                )
            elif request.auth.organization is not None:
                queryset = queryset.filter(
                    id=request.auth.organization.id
                )
        elif member_only or not request.is_superuser():
            queryset = queryset.filter(
                id__in=OrganizationMember.objects.filter(
                    user=request.user,
                ).values('organization'),
            )

        query = request.GET.get('query')
        if query:
            tokens = tokenize_query(query)
            for key, value in six.iteritems(tokens):
                if key == 'query':
                    value = ' '.join(value)
                    queryset = queryset.filter(
                        Q(name__icontains=value) |
                        Q(slug__icontains=value) |
                        Q(members__email__iexact=value)
                    )
                elif key == 'slug':
                    queryset = queryset.filter(
                        in_iexact('slug', value)
                    )
                elif key == 'email':
                    queryset = queryset.filter(
                        in_iexact('members__email', value)
                    )
                elif key == 'platform':
                    queryset = queryset.filter(
                        project__in=ProjectPlatform.objects.filter(
                            platform__in=value,
                        ).values('project_id')
                    )

        sort_by = request.GET.get('sortBy')
        if sort_by == 'members':
            queryset = queryset.annotate(
                member_count=Count('member_set'),
            )
            order_by = '-member_count'
            paginator_cls = OffsetPaginator
        elif sort_by == 'projects':
            queryset = queryset.annotate(
                project_count=Count('project'),
            )
            order_by = '-project_count'
            paginator_cls = OffsetPaginator
        elif sort_by == 'events':
            queryset = queryset.annotate(
                event_count=Sum('stats__events_24h'),
            ).filter(
                stats__events_24h__isnull=False,
            )
            order_by = '-event_count'
            paginator_cls = OffsetPaginator
        else:
            order_by = '-date_added'
            paginator_cls = DateTimePaginator

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=order_by,
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=paginator_cls,
        )

    # XXX: endpoint useless for end-users as it needs user context.
    def post(self, request):
        """
        Create a New Organization
        `````````````````````````

        Create a new organization owned by the request's user.  To create
        an organization only the name is required.

        :param string name: the human readable name for the new organization.
        :param string slug: the unique URL slug for this organization.  If
                            this is not provided a slug is automatically
                            generated based on the name.
        :auth: required, user-context-needed
        """
        if not request.user.is_authenticated():
            return Response({'detail': 'This endpoint requires user info'},
                            status=401)

        serializer = OrganizationSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object

            try:
                with transaction.atomic():
                    org = Organization.objects.create(
                        name=result['name'],
                        slug=result.get('slug'),
                    )
            except IntegrityError:
                return Response(
                    {'detail': 'An organization with this slug already exists.'},
                    status=409,
                )

            OrganizationMember.objects.create(
                user=request.user,
                organization=org,
                role=roles.get_top_dog().id,
            )

            self.create_audit_entry(
                request=request,
                organization=org,
                target_object=org.id,
                event=AuditLogEntryEvent.ORG_ADD,
                data=org.get_audit_log_data(),
            )

            return Response(serialize(org, request.user), status=201)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
