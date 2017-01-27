from __future__ import absolute_import

from sentry.api.serializers import Serializer, register, serialize
from sentry.db.models.query import in_iexact
from sentry.models import Commit, Repository, UserEmail, User


@register(Commit)
class CommitSerializer(Serializer):
    def get_attrs(self, item_list, user):

        authors = set(c.author for c in item_list if c.author is not None)

        user_emails = UserEmail.objects.filter(
            in_iexact('email', [a.email for a in authors]),
        ).order_by('id')
        org_ids = set(item.organization_id for item in item_list)
        assert len(org_ids) == 1
        org_id = org_ids.pop()
        users = User.objects.filter(
            id__in=[ue.user_id for ue in user_emails],
            sentry_orgmember_set__organization_id=org_id
        )
        users_by_id = dict((user.id, serialize(user)) for user in users)
        users_by_email = {}
        for email in user_emails:
            if email.email in users_by_email:
                pass
            user = users_by_id.get(email.user_id)
            users_by_email[email.email] = user

        author_objs = {}
        for author in authors:
            author_objs[author.email] = users_by_email.get(author.email, {
                "name": author.name,
                "email": author.email
            })

        repositories = list(Repository.objects.filter(id__in=[c.repository_id for c in item_list]))
        repository_objs = {}
        for repository in repositories:
            repository_objs[repository.id] = serialize(repository)
        result = {}
        for item in item_list:
            result[item] = {
                'repository': repository_objs.get(item.repository_id, {}),
                'user': author_objs.get(item.author.email, {})
            }

        return result

    def serialize(self, obj, attrs, user):
        d = {
            'id': obj.key,
            'message': obj.message,
            'dateCreated': obj.date_added,
            'repository': attrs.get('repository', {}),
            'author': attrs.get('user', {})
        }

        return d
