from django.apps import apps

from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_all_hybrid_cloud_foreign_keys_generate_outboxes():
    hcfk_models = set()
    for app_models in apps.all_models.values():
        for model in app_models.values():
            if not hasattr(model._meta, "silo_limit"):
                continue
            for field in model._meta.fields:
                if not isinstance(field, HybridCloudForeignKey):
                    continue
                if field.on_delete.upper() in {"CASCADE", "SET_NULL"}:
                    hcfk_models.add((model, field.foreign_model))
    for model, foreign_model in hcfk_models:
        if not (
            hasattr(foreign_model, "outboxes_for_update")
            or hasattr(foreign_model, "outbox_for_update")
        ):
            raise NotImplementedError(
                f"{model.__name__} model uses a HybridCloudForeignKey to the {foreign_model.__name__} model, but it does not produce outboxes!"
            )
