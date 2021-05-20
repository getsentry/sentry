from django.core import mail

from sentry.models import UserOption
from sentry.testutils import APITestCase


class EmailNotificationNoteTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        UserOption.objects.create(user=self.user, key="self_notifications", value="1")

    def test_sends_note(self):
        # create a note
        url = f"/api/0/issues/{self.group.id}/comments/"
        with self.tasks():
            response = self.client.post(url, format="json", data={"text": "blah blah"})
        assert response.status_code == 201, response.content

        msg = mail.outbox[0]
        # check the txt version
        assert "blah blah" in msg.body
        # check the html version
        assert "blah blah</p></div>" in msg.alternatives[0][0]
