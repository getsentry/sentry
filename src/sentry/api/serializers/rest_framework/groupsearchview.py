from rest_framework import serializers

from sentry.models.savedsearch import SortOptions

MAX_VIEWS = 50


class ViewSerializer(serializers.Serializer):
    id = serializers.CharField(required=False)
    name = serializers.CharField(required=True)
    query = serializers.CharField(required=True)
    querySort = serializers.ChoiceField(
        choices=SortOptions.as_choices(), default=SortOptions.DATE, required=False
    )


class GroupSearchViewRestSerializer(serializers.Serializer):
    views = serializers.ListField(child=ViewSerializer(), required=True, max_length=MAX_VIEWS)

    def validate(self, data):
        if len(data.get("views", [])) == 0:
            raise serializers.ValidationError("Must provide at least one view")
        return data
