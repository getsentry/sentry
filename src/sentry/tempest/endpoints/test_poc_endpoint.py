from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from sentry.tempest.models import TestModel


class TestModelSerializer(serializers.ModelSerializer):
    encrypted_string = serializers.CharField()

    class Meta:
        model = TestModel
        fields = "__all__"


class TestModelViewSet(APIView):
    permission_classes = []  # exposed only for testing purposes

    def get(self, request):
        qs = TestModel.objects.all()
        return Response(TestModelSerializer(qs, many=True).data)

    def post(self, request):
        serializer = TestModelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
