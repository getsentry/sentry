from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri
from sentry.models import ProjectOption
from django.utils.text import slugify


class PluginSerializer(Serializer):
    def __init__(self, project=None):
        self.project = project

    def serialize(self, obj, attrs, user):
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

        contexts = []
        if hasattr(obj, "get_custom_contexts"):
            contexts.extend(x.type for x in obj.get_custom_contexts() or ())
        d = {
            "id": obj.slug,
            "name": six.text_type(obj.get_title()),
            "slug": obj.slug or slugify(six.text_type(obj.get_title())),
            "shortName": six.text_type(obj.get_short_title()),
            "type": obj.get_plugin_type(),
            "canDisable": obj.can_disable,
            "isTestable": hasattr(obj, "is_testable") and obj.is_testable(),
            "hasConfiguration": obj.has_project_conf(),
            "metadata": obj.get_metadata(),
            "contexts": contexts,
            "status": obj.get_status(),
            # TODO: remove assets since they are unused
            "assets": [
                {"url": absolute_uri(get_asset_url(obj.asset_key or obj.slug, asset))}
                for asset in obj.get_assets()
            ],
            "doc": doc,
        }
        if self.project:
            d["enabled"] = obj.is_enabled(self.project)

        if obj.version:
            d["version"] = six.text_type(obj.version)

        if obj.author:
            d["author"] = {"name": six.text_type(obj.author), "url": six.text_type(obj.author_url)}

        d["isHidden"] = d.get("enabled", False) is False and obj.is_hidden()

        if obj.description:
            d["description"] = six.text_type(obj.description)

        d["features"] = list(set(f.featureGate.value for f in obj.feature_descriptions))

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

    def serialize(self, obj, attrs, user):
        d = super(PluginWithConfigSerializer, self).serialize(obj, attrs, user)
        d["config"] = [
            serialize_field(self.project, obj, c)
            for c in obj.get_config(project=self.project, user=user, add_additial_fields=True)
        ]
        return d


def serialize_field(project, plugin, field):
    data = {
        "name": six.text_type(field["name"]),
        "label": six.text_type(field.get("label") or field["name"].title().replace("_", " ")),
        "type": field.get("type", "text"),
        "required": field.get("required", True),
        "help": six.text_type(field["help"]) if field.get("help") else None,
        "placeholder": six.text_type(field["placeholder"]) if field.get("placeholder") else None,
        "choices": field.get("choices"),
        "readonly": field.get("readonly", False),
        "defaultValue": field.get("default"),
        "value": None,
    }
    if field.get("type") != "secret":
        data["value"] = plugin.get_option(field["name"], project)
    else:
        data["hasSavedValue"] = bool(field.get("has_saved_value", False))
        data["prefix"] = field.get("prefix", "")

    return data
