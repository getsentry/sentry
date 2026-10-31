from itertools import chain

from django.db.models import Model


# https://docs.djangoproject.com/en/1.10/ref/models/meta/#migrating-from-the-old-api
# https://github.com/python-social-auth/social-app-django/commit/65b68d5e47f6990625c19afe8317397bdbbb11cd
def get_all_field_names(model: Model | type[Model]) -> list[str]:
    return list(
        set(
            chain.from_iterable(
                (field.name, field.attname) if hasattr(field, "attname") else (field.name,)
                for field in model._meta.get_fields()
                if not (field.many_to_one and field.related_model is None)
            )
        )
    )
