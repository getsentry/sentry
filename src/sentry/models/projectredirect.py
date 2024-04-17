from django.db import models
from django.utils import timezone

from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.sanitize import SanitizableField, Sanitizer
from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model
from sentry.utils.json import JSONData


@region_silo_model
class ProjectRedirect(Model):
    __relocation_scope__ = RelocationScope.Organization

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

    @classmethod
    def sanitize_relocation_json(
        cls, json: JSONData, sanitizer: Sanitizer, model_name: NormalizedModelName | None = None
    ) -> None:
        model_name = get_model_name(cls) if model_name is None else model_name
        super().sanitize_relocation_json(json, sanitizer, model_name)

        sanitizer.set_slug(json, SanitizableField(model_name, "redirect_slug"))
