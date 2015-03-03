from django.core.urlresolvers import reverse
from sentry.models import TagKey, GroupTagKey, GroupTagValue
from sentry.testutils import APITestCase


class GroupTagDetailsTest(APITestCase):
    def test_simple(self):
        group = self.create_group()
        group.data['tags'] = (['foo', 'bar'],)
        group.save()

        key, value = group.data['tags'][0]

        tagkey = TagKey.objects.create(
            project=group.project,
            key=key,
            values_seen=1,
        )
        GroupTagKey.objects.create(
            project=group.project,
            group=group,
            key=key,
            values_seen=1,
        )
        GroupTagValue.objects.create(
            project=group.project,
            group=group,
            key=key,
            value=value,
            times_seen=1,
        )

        self.login_as(user=self.user)

        url = reverse('sentry-api-0-group-tagkey-details', kwargs={
            'group_id': group.id,
            'key': tagkey.key,
        })
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert response.data['id'] == str(tagkey.id)
        assert response.data['uniqueValues'] == 1
        assert response.data['totalValues'] == 1
