from rest_framework import serializers

from sentry.models.savedsearch import SortOptions, Visibility


class OrganizationSearchSerializer(serializers.Serializer):
    type = serializers.IntegerField(required=True)
    name = serializers.CharField(required=True)
    query = serializers.CharField(required=True, min_length=1)
    sort = serializers.ChoiceField(
        choices=SortOptions.as_choices(), default=SortOptions.DATE, required=False
    )
    # TODO(epurkhiser): Once the frontend is deployed we should change this to
    # default to OWNER since that is a more sane default than organization
    # visibile.
    visibility = serializers.ChoiceField(
        choices=Visibility.as_choices(include_pinned=False),
        default=Visibility.ORGANIZATION,
        required=False,
    )
