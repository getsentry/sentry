from sentry.seer.agent.embed_widgets import strip_embed_widgets


def test_strips_paired_widget_tag() -> None:
    text = (
        'first seen at {% timestamp %}{"value": "2026-07-09T17:14:03", '
        '"format": "relative"}{% /timestamp %} ago'
    )
    assert strip_embed_widgets(text) == "first seen at  ago"


def test_strips_self_closing_widget_tag() -> None:
    assert strip_embed_widgets('before {% foo bar="x" /%} after') == "before  after"


def test_strips_widget_tag_with_attributes() -> None:
    text = '{% timestamp format="relative" %}{"value": "x"}{% /timestamp %}'
    assert strip_embed_widgets(text) == ""


def test_leaves_plain_text_untouched() -> None:
    text = "Your most recent issue is SDK-CRASHES-COCOA-15DT, about 2 minutes ago."
    assert strip_embed_widgets(text) == text


def test_ignores_non_tag_braces() -> None:
    # No whitespace around the name, so the frontend would not treat this as a tag.
    text = "the value is {%notatag%} here"
    assert strip_embed_widgets(text) == text


def test_preserves_tags_inside_inline_code() -> None:
    text = "use `{% timestamp %}x{% /timestamp %}` in your template"
    assert strip_embed_widgets(text) == text


def test_preserves_tags_inside_fenced_code_block() -> None:
    text = "example:\n```\n{% timestamp %}\n{...}\n{% /timestamp %}\n```\ndone"
    assert strip_embed_widgets(text) == text


def test_preserves_tags_inside_tilde_fenced_code_block() -> None:
    text = "example:\n~~~\n{% foo /%}\n~~~\ndone"
    assert strip_embed_widgets(text) == text


def test_strips_prose_tag_but_keeps_code_tag() -> None:
    text = "at {% timestamp %}{}{% /timestamp %} — see `{% timestamp %}`"
    assert strip_embed_widgets(text) == "at  — see `{% timestamp %}`"


def test_strips_multiple_widgets() -> None:
    text = "a {% timestamp %}{}{% /timestamp %} b {% timestamp %}{}{% /timestamp %} c"
    assert strip_embed_widgets(text) == "a  b  c"


def test_leaves_unclosed_tag_in_prose() -> None:
    # No matching close tag, so the frontend would render this as literal text too.
    text = "in Jinja you write {% for item in items %} to loop"
    assert strip_embed_widgets(text) == text


def test_preserves_tags_inside_fenced_block_with_language() -> None:
    text = "```jinja\n{% for x in y %}{% /for %}\n```"
    assert strip_embed_widgets(text) == text
