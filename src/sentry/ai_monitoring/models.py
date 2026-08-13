from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, cell_silo_model, sane_repr


@cell_silo_model
class AIConversationMetadata(DefaultFieldsModel):
    """
    Metadata for a gen_ai conversation.
    """

    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)

    conversation_id = models.CharField(max_length=2048)
    # sha256 hex — keeps the unique index under Postgres
    # btree entry limits and it's more performant to scan smaller string
    conversation_id_hash = models.CharField(max_length=256)

    title = models.CharField(max_length=4096, null=True)
    # Span start_timestamp of the first-user-message we titled from.
    title_source_timestamp = models.DateTimeField(null=True)

    class Meta:
        app_label = "ai_monitoring"
        db_table = "ai_monitoring_aiconversationmetadata"
        constraints = [
            models.UniqueConstraint(
                fields=["project", "conversation_id_hash"],
                name="ai_monitoring_aiconvmeta_proj_convid_hash_uniq",
            ),
        ]

    __repr__ = sane_repr("project_id", "conversation_id_hash")
