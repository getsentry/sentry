from sentry.models import ApiApplication, ApiGrant, ApiToken, ScheduledDeletion, ServiceHook
from sentry.models.apiapplication import ApiApplicationStatus
from sentry.tasks.deletion.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.tasks.deletion.scheduled import run_deletion
from sentry.testutils import TransactionTestCase
from sentry.testutils.outbox import outbox_runner


class DeleteApiApplicationTest(TransactionTestCase):
    def test_simple(self):
        app = ApiApplication.objects.create(
            owner=self.user, status=ApiApplicationStatus.pending_deletion
        )
        ApiToken.objects.create(application=app, user=self.user, scopes=0)
        ApiGrant.objects.create(
            application=app, user=self.user, scopes=0, redirect_uri="http://example.com"
        )
        service_hook = self.create_service_hook(application=app)
        sh_id = service_hook.id

        deletion = ScheduledDeletion.schedule(app, days=0)
        deletion.update(in_progress=True)

        with self.tasks(), outbox_runner():
            run_deletion(deletion.id)

        assert not ApiApplication.objects.filter(id=app.id).exists()
        assert not ApiGrant.objects.filter(application=app).exists()
        assert not ApiToken.objects.filter(application=app).exists()
        assert ServiceHook.objects.filter(id=sh_id).exists()

        with self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs()

        assert not ServiceHook.objects.filter(id=sh_id).exists()

    def test_skip_active(self):
        app = ApiApplication.objects.create(owner=self.user, status=ApiApplicationStatus.active)
        ApiToken.objects.create(application=app, user=self.user, scopes=0)
        ApiGrant.objects.create(
            application=app, user=self.user, scopes=0, redirect_uri="http://example.com"
        )

        deletion = ScheduledDeletion.schedule(app, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert ApiApplication.objects.filter(id=app.id).exists()
        assert ApiGrant.objects.filter(application=app).exists()
        assert ApiToken.objects.filter(application=app).exists()
