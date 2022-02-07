from rest_framework import serializers


class RelayIdSerializer(serializers.Serializer):
    relay_id = serializers.RegexField(
        r"^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$", required=True
    )
