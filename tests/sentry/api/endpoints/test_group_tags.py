from django.core.urlresolvers import reverse
from sentry.models import TagKey, GroupTagKey, GroupTagValue
from sentry.testutils import APITestCase


class GroupTagsTest(APITestCase):
    def test_simple(self):
        group = self.create_group()
        group.data['tags'] = (['foo', 'bar'], ['biz', 'baz'])
        group.save()

        for key, value in group.data['tags']:
            TagKey.objects.create(
                project=group.project,
                key=key,
            )
            GroupTagKey.objects.create(
                project=group.project,
                group=group,
                key=key,
            )
            GroupTagValue.objects.create(
                project=group.project,
                group=group,
                key=key,
                value=value,
            )

        self.login_as(user=self.user)

        url = reverse('sentry-api-0-group-tags', kwargs={
            'group_id': group.id,
        })
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
