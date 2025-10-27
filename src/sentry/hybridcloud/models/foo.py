from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model
from sentry.db.models.base import region_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.users.models.user import User


@region_silo_model
class FooUser(Model):
    __relocation_scope__ = RelocationScope.Excluded
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")

    class Meta:
        app_label = "hybridcloud"
        db_table = "hybridcloud_foo"


# Determine Silo Later
def update_user_to_be_foo(user_id: int) -> None:
    User.objects.filter(id=user_id).update(name="Foo", email="foo@example.com")
    FooUser.objects.create(user_id=user_id)
