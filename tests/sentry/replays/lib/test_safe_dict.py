from sentry.replays.lib.safe_dict import MISSING, safe_view


def test_safe_view_lookups() -> None:
    view = safe_view(
        {
            "obj": {"key": "value"},
            "zero": 0,
            "float": 1.5,
            "filtered": "[Filtered]",
            "blank": " ",
            "flag": True,
            "list": [1],
            "empty": {},
            "null": None,
        }
    )
    assert view["obj"]["key"] == "value"
    assert view["zero"] == "0"
    assert view["float"] == "1.5"
    assert view["filtered"] == "[Filtered]"
    assert view["filtered"]["method"] is MISSING
    assert view["filtered"][1:4] == "Fil"
    for key in ("blank", "flag", "list", "empty", "null", "absent"):
        assert view[key] is MISSING
        assert view[key]["deeper"]["still"] is MISSING
    assert f"{view['absent']}" == ""
    assert (view["absent"] or "fallback") == "fallback"
    assert view.get("flag") is True
    assert view["absent"].get("anything") is None
