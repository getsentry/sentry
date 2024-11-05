from django.db import models
from django.utils.translation import gettext_lazy as _


class DynamicSamplingMode(models.TextChoices):
    ORGANIZATION = "organization", _("Organization")
    PROJECT = "project", _("Project")
