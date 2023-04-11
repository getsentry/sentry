# from io import BytesIO
#
# from sentry.api.utils import generate_region_url
# from sentry.models import File, UserAvatar
# from sentry.testutils.cases import TestMigrations
#
#
# class TestBackfillUserAvatarsMigration(TestMigrations):
#     migrate_from = "0403_backfill_actors"
#     migrate_to = "0404_backfill_user_avatars"
#
#     def setup_before_migration(self, apps):
#         self.user_letter = self.create_user(email="a@example.com")
#         self.user_upload = self.create_user(email="b@example.com")
#         photo = File.objects.create(name="test.png", type="avatar.file")
#         photo.putfile(BytesIO(b"test"))
#         self.avatar = UserAvatar.objects.create(
#             user=self.user_upload, file_id=photo.id, avatar_type=1
#         )
#
#     def test(self):
#         self.user_letter.refresh_from_db()
#         self.user_upload.refresh_from_db()
#
#         assert self.user_letter.avatar_type == 0
#         assert self.user_letter.avatar_url is None
#
#         assert self.user_upload.avatar_type == 1
#         assert self.user_upload.avatar_url == f"{generate_region_url()}/avatar/{self.avatar.ident}/"
