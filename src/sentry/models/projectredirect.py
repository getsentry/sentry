from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.db.models import Model, FlexibleForeignKey


class ProjectRedirect(Model):
    __core__ = True

    redirect_slug = models.SlugField(db_index=True)
    project = FlexibleForeignKey("sentry.Project")
    organization = FlexibleForeignKey("sentry.Organization")
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectredirect"
        unique_together = (("organization", "redirect_slug"),)

    @classmethod
    def record(cls, project, historic_slug):
        """
        Records a historic slug used for redirect purposes. Overwrites
        historic redirect slugs from previous projects
        """
        redirect, created = cls.objects.get_or_create(
            redirect_slug=historic_slug,
            organization=project.organization,
            defaults={"project": project},
        )

        if not created:
            redirect.update(project=project)
