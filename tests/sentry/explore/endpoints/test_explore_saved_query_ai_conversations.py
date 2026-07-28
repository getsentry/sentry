from django.urls import reverse

from sentry.explore.models import (
    ExploreSavedQuery,
    ExploreSavedQueryDataset,
    ExploreSavedQueryStarred,
)
from sentry.testutils.cases import APITestCase


class ExploreSavedQueryAIConversationsTest(APITestCase):
    """Tests that ai_conversations saved queries work through the same
    create / read / update / delete flow as any other dataset."""

    features = {
        "organizations:visibility-explore-view": True,
    }

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.list_url = reverse("sentry-api-0-explore-saved-queries", args=[self.org.slug])

    def _detail_url(self, query_id: int) -> str:
        return reverse(
            "sentry-api-0-explore-saved-query-detail",
            args=[self.org.slug, query_id],
        )

    # ── Create ──────────────────────────────────────────────────────────

    def test_post_creates_ai_conversations_query(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.list_url,
                {
                    "name": "My conversations query",
                    "projects": [self.project.id],
                    "dataset": "ai_conversations",
                    "range": "24h",
                    "environment": ["production"],
                    "query": [
                        {
                            "fields": [],
                            "mode": "samples",
                            "query": "gen_ai.conversation.id:abc123",
                        }
                    ],
                },
            )

        assert response.status_code == 201, response.content
        assert response.data["dataset"] == "ai_conversations"
        assert response.data["name"] == "My conversations query"
        assert response.data["range"] == "24h"
        assert response.data["environment"] == ["production"]
        assert response.data["query"] == [
            {
                "caseInsensitive": False,
                "fields": [],
                "mode": "samples",
                "query": "gen_ai.conversation.id:abc123",
            }
        ]

        model = ExploreSavedQuery.objects.get(id=response.data["id"])
        assert model.dataset == ExploreSavedQueryDataset.AI_CONVERSATIONS

    def test_post_creates_starred_by_default(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.list_url,
                {
                    "name": "Starred conversations",
                    "projects": [self.project.id],
                    "dataset": "ai_conversations",
                    "range": "24h",
                    "starred": True,
                    "query": [{"fields": [], "mode": "samples"}],
                },
            )

        assert response.status_code == 201, response.content
        query_id = int(response.data["id"])
        assert ExploreSavedQueryStarred.objects.filter(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query_id=query_id,
            starred=True,
        ).exists()

    def test_post_preserves_agent_filter(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.list_url,
                {
                    "name": "Agent-filtered query",
                    "projects": [self.project.id],
                    "dataset": "ai_conversations",
                    "range": "24h",
                    "agent": ["my-agent", "other-agent"],
                    "query": [{"fields": [], "mode": "samples"}],
                },
            )

        assert response.status_code == 201, response.content
        assert response.data["agent"] == ["my-agent", "other-agent"]

        # Verify round-trip through detail endpoint
        with self.feature(self.features):
            detail = self.client.get(self._detail_url(int(response.data["id"])))
        assert detail.status_code == 200
        assert detail.data["agent"] == ["my-agent", "other-agent"]

    # ── Read ────────────────────────────────────────────────────────────

    def test_get_returns_ai_conversations_query(self) -> None:
        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Conversations overview",
            query={
                "range": "24h",
                "query": [{"fields": [], "mode": "samples", "query": ""}],
            },
            dataset=ExploreSavedQueryDataset.AI_CONVERSATIONS,
        )
        model.set_projects([self.project.id])

        with self.feature(self.features):
            response = self.client.get(self._detail_url(model.id))

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(model.id)
        assert response.data["dataset"] == "ai_conversations"
        assert response.data["name"] == "Conversations overview"

    def test_list_includes_ai_conversations_query(self) -> None:
        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Conversations list test",
            query={
                "range": "24h",
                "query": [{"fields": [], "mode": "samples"}],
            },
            dataset=ExploreSavedQueryDataset.AI_CONVERSATIONS,
        )
        model.set_projects([self.project.id])

        with self.feature(self.features):
            response = self.client.get(
                self.list_url, data={"query": "name:Conversations list test"}
            )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["dataset"] == "ai_conversations"

    # ── Update ──────────────────────────────────────────────────────────

    def test_put_updates_ai_conversations_query(self) -> None:
        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Original name",
            query={
                "range": "24h",
                "query": [{"fields": [], "mode": "samples", "query": ""}],
            },
            dataset=ExploreSavedQueryDataset.AI_CONVERSATIONS,
        )
        model.set_projects([self.project.id])

        with self.feature(self.features):
            response = self.client.put(
                self._detail_url(model.id),
                {
                    "name": "Updated name",
                    "projects": [self.project.id],
                    "dataset": "ai_conversations",
                    "range": "7d",
                    "query": [
                        {
                            "fields": [],
                            "mode": "samples",
                            "query": "gen_ai.conversation.id:new",
                        }
                    ],
                },
            )

        assert response.status_code == 200, response.content
        assert response.data["name"] == "Updated name"
        assert response.data["range"] == "7d"
        assert response.data["dataset"] == "ai_conversations"
        assert response.data["query"] == [
            {
                "caseInsensitive": False,
                "fields": [],
                "mode": "samples",
                "query": "gen_ai.conversation.id:new",
            }
        ]

        model.refresh_from_db()
        assert model.dataset == ExploreSavedQueryDataset.AI_CONVERSATIONS

    # ── Delete ──────────────────────────────────────────────────────────

    def test_delete_removes_ai_conversations_query(self) -> None:
        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="To be deleted",
            query={
                "range": "24h",
                "query": [{"fields": [], "mode": "samples"}],
            },
            dataset=ExploreSavedQueryDataset.AI_CONVERSATIONS,
        )
        model.set_projects([self.project.id])

        with self.feature(self.features):
            response = self.client.delete(self._detail_url(model.id))

        assert response.status_code == 204
        assert not ExploreSavedQuery.objects.filter(id=model.id).exists()

    def test_delete_cleans_up_starred(self) -> None:
        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Starred then deleted",
            query={
                "range": "24h",
                "query": [{"fields": [], "mode": "samples"}],
            },
            dataset=ExploreSavedQueryDataset.AI_CONVERSATIONS,
        )
        model.set_projects([self.project.id])
        ExploreSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query=model,
            position=1,
            starred=True,
        )

        with self.feature(self.features):
            response = self.client.delete(self._detail_url(model.id))

        assert response.status_code == 204
        assert not ExploreSavedQueryStarred.objects.filter(
            explore_saved_query_id=model.id,
        ).exists()
