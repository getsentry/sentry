import orjson

from sentry.preprod.api.renderers import OrjsonRenderer


class TestOrjsonRenderer:
    def test_media_type_and_format(self) -> None:
        renderer = OrjsonRenderer()
        assert renderer.media_type == "application/json"
        assert renderer.format == "json"

    def test_renders_dict_as_json_bytes(self) -> None:
        data = {"b": "x", "a": 1, "nested": {"n": [1, 2, 3]}}
        rendered = OrjsonRenderer().render(data)

        assert isinstance(rendered, bytes)
        assert orjson.loads(rendered) == data

    def test_renders_none_as_empty_bytes(self) -> None:
        assert OrjsonRenderer().render(None) == b""

    def test_preserves_unicode_as_raw_utf8(self) -> None:
        rendered = OrjsonRenderer().render({"name": "café"})

        assert "café".encode() in rendered
        assert b"\\u" not in rendered

    def test_uses_default_encoder_for_non_primitives(self) -> None:
        rendered = OrjsonRenderer().render({"tags": {"b", "a"}})

        assert sorted(orjson.loads(rendered)["tags"]) == ["a", "b"]
