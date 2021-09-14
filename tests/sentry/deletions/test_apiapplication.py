from sentry.models import ApiApplication, ApiGrant, ApiToken, ScheduledDeletion
from sentry.models.apiapplication import ApiApplicationStatus
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TransactionTestCase


class DeleteApiApplicationTest(TransactionTestCase):
    def test_simple(self):
        app = ApiApplication.objects.create(
            owner=self.user, status=ApiApplicationStatus.pending_deletion
        )
        ApiToken.objects.create(application=app, user=self.user, scopes=0)
        ApiGrant.objects.create(
            application=app, user=self.user, scopes=0, redirect_uri="http://example.com"
        )

        deletion = ScheduledDeletion.schedule(app, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not ApiApplication.objects.filter(id=app.id).exists()
        assert not ApiGrant.objects.filter(application=app).exists()
        assert not ApiToken.objects.filter(application=app).exists()

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
