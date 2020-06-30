from __future__ import absolute_import

import six

from django.db.models import Q
from rest_framework import status, serializers
from rest_framework.response import Response

from sentry import roles
from sentry.api.base import Endpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.permissions import SuperuserPermission
from sentry.api.serializers import serialize
from sentry.db.models.query import in_iexact
from sentry.models import User, Organization, OrganizationMember, OrganizationMemberTeam, Team
from sentry.search.utils import tokenize_query


class UserCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(max_length=256)
    is_superuser = serializers.BooleanField(required=False)
    force_update = serializers.BooleanField(required=False)


class UserIndexEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request):
        queryset = User.objects.distinct()

        query = request.GET.get("query")
        if query:
            tokens = tokenize_query(query)
            for key, value in six.iteritems(tokens):
                if key == "query":
                    value = " ".join(value)
                    queryset = queryset.filter(
                        Q(name__icontains=value)
                        | Q(username__icontains=value)
                        | Q(email__icontains=value)
                        | Q(emails__email__icontains=value)
                    )
                elif key == "id":
                    queryset = queryset.filter(
                        id__in=[request.user.id if v == "me" else v for v in value]
                    )
                elif key == "name":
                    queryset = queryset.filter(in_iexact("name", value))
                elif key == "email":
                    queryset = queryset.filter(in_iexact("email", value))
                elif key == "username":
                    queryset = queryset.filter(in_iexact("username", value))
                elif key == "is":
                    for v in value:
                        if v == "superuser":
                            queryset = queryset.filter(is_superuser=True)
                        else:
                            queryset = queryset.none()
                elif key == "permission":
                    queryset = queryset.filter(
                        userpermission__permission__in=[v.lower() for v in value]
                    )
                else:
                    queryset = queryset.none()

        status = request.GET.get("status")
        if status == "active":
            queryset = queryset.filter(is_active=True)
        elif status == "disabled":
            queryset = queryset.filter(is_active=False)

        order_by = "-date_joined"
        paginator_cls = DateTimePaginator

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=order_by,
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=paginator_cls,
        )

    def post(self, request):
        """
        Create a new User
        ``````````````````
        :param string email: the email of the user.
        :param string password: the password of the user.
        :param boolean is_superuser: the optional superuser status of the user.
                                    If not provided it will be False.
        :param boolean force_update: the optional force_update for this user.
                                    If not provided it will be False.
        :auth: required
        """

        serializer = UserCreateSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data.get("email")
            password = serializer.validated_data.get("password")
            superuser = serializer.validated_data.get("is_superuser", False)
            force_update = serializer.validated_data.get("force_update", False)

            try:
                user = User.objects.get(username=email)
                if not force_update:
                    return Response(
                        "User: %s exists, use force-update to force" % (email,),
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                user.set_password(password)
                user.is_superuser = superuser
                user.is_staff = superuser
                user.save()
            except User.DoesNotExist:
                user = User(email=email, username=email, is_superuser=superuser, is_staff=superuser)
                user.set_password(password)
                user.save()

                org = Organization.get_default()
                if superuser:
                    role = roles.get_top_dog().id
                else:
                    role = org.default_role
                member = OrganizationMember.objects.create(organization=org, user=user, role=role)
                teams = list(Team.objects.filter(organization=org)[0:2])
                if len(teams) == 1:
                    OrganizationMemberTeam.objects.create(team=teams[0], organizationmember=member)
            return Response(serialize(user, request.user), status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
