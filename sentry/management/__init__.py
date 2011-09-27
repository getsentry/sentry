from django.contrib.auth.models import User
from django.db.models.signals import post_syncdb

from sentry import models

def create_default_project(app, created_models, verbosity=2, **kwargs):
    if models.Project in created_models:
        try:
            owner = User.objects.filter(is_staff=True, is_superuser=True).order_by('id').get()
        except User.DoesNotExist:
            return

        project, created = models.Project.objects.get_or_create(
            id=1,
            defaults=dict(
                public=True,
                name='Default',
                owner=owner,
            )
        )
        if not created:
            return

        project.member_set.add(owner, is_superuser=True)

        if verbosity > 0:
            print 'Created default Sentry project owned by %s' % owner

post_syncdb.connect(create_default_project, sender=models)