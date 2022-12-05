from typing import List

from rest_framework import serializers

from sentry.models.savedsearch import SortOptions, Visibility


def select_visibility_choices(allowed_visibility: List[str]):
    return list(filter(lambda item: item[0] in allowed_visibility, Visibility.as_choices()))


class BaseOrganizationSearchSerializer(serializers.Serializer):
    type = serializers.IntegerField(required=True)
    name = serializers.CharField(required=True)
    query = serializers.CharField(required=True, min_length=1)
    sort = serializers.ChoiceField(
        choices=SortOptions.as_choices(), default=SortOptions.DATE, required=False
    )


class OrganizationSearchAdminSerializer(BaseOrganizationSearchSerializer):
    """
    Organization admins/owners may create organization wide saved searches
    """

    # TODO(epurkhiser): Once the frontend is deployed we should change this to
    # default to OWNER since that is a more sane default than organization
    # visibile.
    visibility = serializers.ChoiceField(
        choices=select_visibility_choices([Visibility.OWNER, Visibility.ORGANIZATION]),
        default=Visibility.ORGANIZATION,
        required=False,
    )


class OrganizationSearchMemberSerializer(BaseOrganizationSearchSerializer):
    """
    Organization members may only set visibility to Visibility.OWNER
    """

    visibility = serializers.ChoiceField(
        choices=select_visibility_choices([Visibility.OWNER]),
        default=Visibility.OWNER,
        required=False,
    )
