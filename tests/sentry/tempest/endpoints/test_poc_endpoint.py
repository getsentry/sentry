from rest_framework import status
from rest_framework.test import APITestCase


class TestPocEndpoint(APITestCase):
    url = "/encrypted/test-poc/"

    def test_get_test_model(self):
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK

    def test_create_test_model(self):
        response = self.client.post(self.url, data={"encrypted_string": "test"})
        assert response.status_code == status.HTTP_201_CREATED
