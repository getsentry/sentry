from sentry.api.serializers import serialize
from sentry.models import SavedSearch
from sentry.testutils import TestCase


class SavedSearchSerializerTest(TestCase):
    def test_simple(self):
        search = SavedSearch.objects.create(
            project=self.project, name="Something", query="some query"
        )
        result = serialize(search)

        assert result["id"] == str(search.id)
        assert result["projectId"] == str(search.project_id)
        assert result["type"] == search.type
        assert result["name"] == search.name
        assert result["query"] == search.query
        assert result["isDefault"] == search.is_default
        assert result["isUserDefault"] == search.is_default
        assert result["dateCreated"] == search.date_added
        assert not result["isPrivate"]
        assert not result["isGlobal"]
        assert not result["isPinned"]

    def test_global(self):
        search = SavedSearch(name="Unresolved Issues", query="is:unresolved", is_global=True)
        result = serialize(search)

        assert result["id"] == str(search.id)
        assert result["projectId"] is None
        assert result["type"] == search.type
        assert result["name"] == search.name
        assert result["query"] == search.query
        assert not result["isDefault"]
        assert not result["isUserDefault"]
        assert result["dateCreated"] == search.date_added
        assert not result["isPrivate"]
        assert result["isGlobal"]
        assert not result["isPinned"]

    def test_organization(self):
        search = SavedSearch.objects.create(
            organization=self.organization, name="Something", query="some query"
        )
        result = serialize(search)

        assert result["id"] == str(search.id)
        assert result["projectId"] is None
        assert result["type"] == search.type
        assert result["name"] == search.name
        assert result["query"] == search.query
        assert not result["isDefault"]
        assert not result["isUserDefault"]
        assert result["dateCreated"] == search.date_added
        assert not result["isPrivate"]
        assert not result["isGlobal"]
        assert not result["isPinned"]

    def test_pinned(self):
        search = SavedSearch.objects.create(
            organization=self.organization, owner=self.user, name="Something", query="some query"
        )
        result = serialize(search)

        assert result["id"] == str(search.id)
        assert result["projectId"] is None
        assert result["type"] == search.type
        assert result["name"] == search.name
        assert result["query"] == search.query
        assert not result["isDefault"]
        assert not result["isUserDefault"]
        assert result["dateCreated"] == search.date_added
        assert result["isPrivate"]
        assert not result["isGlobal"]
        assert result["isPinned"]
