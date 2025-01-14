from datetime import datetime

from django.utils.text import slugify

from sentry import features
from sentry.api.serializers import Serializer
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project

# Dict with the plugin_name as the key, and enabling_feature_name as the value
SHADOW_DEPRECATED_PLUGINS: dict[str, str] = {
    # "exampleslug": "organizations:integrations-ignore-exampleslug-deprecation"
}


def is_plugin_deprecated(plugin, project: Project) -> bool:
    """
    Determines whether or not a plugin has been deprecated.
    If it is past the `deprecation_date` this will always be True.
    If not, it checks the `SHADOW_DEPRECATED_PLUGINS` map and will return True only if
    the plugin slug is present and the organization doesn't have the override feature.
    """
    deprecation_date = getattr(plugin, "deprecation_date", None)
    is_past_deprecation_date = datetime.today() > deprecation_date if deprecation_date else False
    return is_past_deprecation_date or (
        plugin.slug in SHADOW_DEPRECATED_PLUGINS
        and not features.has(
            SHADOW_DEPRECATED_PLUGINS[plugin.slug], getattr(project, "organization", None)
        )
    )


class PluginSerializer(Serializer):
    def __init__(self, project=None):
        self.project = project

    def serialize(self, obj, attrs, user, **kwargs):
        from sentry.api.endpoints.project_releases_token import _get_webhook_url

        doc = ""

        if self.project is not None:
            release_token = ProjectOption.objects.get_value(self.project, "sentry:release-token")
            if release_token is not None:
                webhook_url = _get_webhook_url(self.project, obj.slug, release_token)

                if hasattr(obj, "get_release_doc_html"):
                    try:
                        doc = obj.get_release_doc_html(webhook_url)
                    except NotImplementedError:
                        pass

        contexts: list[str] = []
        if hasattr(obj, "get_custom_contexts"):
            contexts.extend(x.type for x in obj.get_custom_contexts() or ())

        deprecation_date = getattr(obj, "deprecation_date", None)

        d = {
            "id": obj.slug,
            "name": str(obj.get_title()),
            "slug": obj.slug or slugify(str(obj.get_title())),
            "shortName": str(obj.get_short_title()),
            "type": obj.get_plugin_type(),
            "canDisable": obj.can_disable,
            "isTestable": hasattr(obj, "is_testable") and obj.is_testable(),
            "hasConfiguration": obj.has_project_conf(),
            "metadata": obj.get_metadata(),
            "contexts": contexts,
            "status": obj.get_status(),
            "doc": doc,
            "firstPartyAlternative": getattr(obj, "alternative", None),
            "deprecationDate": (
                deprecation_date.strftime("%b %-d, %Y") if deprecation_date else None
            ),
            "altIsSentryApp": getattr(obj, "alt_is_sentry_app", None),
        }
        if self.project:
            d["enabled"] = obj.is_enabled(self.project)

        if obj.version:
            d["version"] = str(obj.version)

        if obj.author:
            d["author"] = {"name": str(obj.author), "url": str(obj.author_url)}

        d["isDeprecated"] = is_plugin_deprecated(obj, self.project)

        d["isHidden"] = d["isDeprecated"] or (not d.get("enabled", False) and obj.is_hidden())

        if obj.description:
            d["description"] = str(obj.description)

        d["features"] = list({f.featureGate.value for f in obj.feature_descriptions})

        d["featureDescriptions"] = [
            {
                "description": f.description.strip(),
                "featureGate": obj.feature_flag_name(f.featureGate.value),
            }
            for f in obj.feature_descriptions
        ]

        if obj.resource_links:
            d["resourceLinks"] = [
                {"title": title, "url": url} for [title, url] in obj.resource_links
            ]

        return d


class PluginWithConfigSerializer(PluginSerializer):
    def __init__(self, project=None):
        self.project = project

    def get_attrs(self, item_list, user, **kwargs):
        return {
            item: {
                "config": [
                    serialize_field(self.project, item, c)
                    for c in item.get_config(
                        project=self.project, user=user, add_additional_fields=True
                    )
                ]
            }
            for item in item_list
        }

    def serialize(self, obj, attrs, user, **kwargs):
        d = super().serialize(obj, attrs, user)
        d["config"] = attrs.get("config")
        return d


def serialize_field(project, plugin, field):
    data = {
        "name": str(field["name"]),
        "label": str(field.get("label") or field["name"].title().replace("_", " ")),
        "type": field.get("type", "text"),
        "required": field.get("required", True),
        "help": str(field["help"]) if field.get("help") else None,
        "placeholder": str(field["placeholder"]) if field.get("placeholder") else None,
        "choices": field.get("choices"),
        "readonly": field.get("readonly", False),
        "defaultValue": field.get("default"),
        "value": None,
        "isDeprecated": is_plugin_deprecated(plugin, project),
    }

    data["isHidden"] = data["isDeprecated"] or plugin.is_hidden()
    if field.get("type") != "secret":
        data["value"] = plugin.get_option(field["name"], project)
    else:
        data["hasSavedValue"] = bool(field.get("has_saved_value", False))
        data["prefix"] = field.get("prefix", "")

    return data
