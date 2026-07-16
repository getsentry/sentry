from sentry.seer.agent.embed_parser import has_embed_tags, tokenize


class TestTokenize:
    def test_plain_markdown(self):
        tokens = tokenize("Hello **world**.")
        assert not has_embed_tags(tokens)
        types = [t["type"] for t in tokens if t["type"] != "blank_line"]
        assert "paragraph" in types

    def test_block_level_tag(self):
        text = '{% thinking %}{"content": "analyzing"}{% /thinking %}'
        tokens = tokenize(text)
        assert has_embed_tags(tokens)
        tag = next(t for t in tokens if t["type"] == "seer_tag")
        assert tag["attrs"]["name"] == "thinking"
        assert tag["attrs"]["level"] == "block"
        assert tag["attrs"]["data"] == {"content": "analyzing"}

    def test_inline_tag_in_paragraph(self):
        text = 'Seen {% timestamp value="2026-07-15T14:30:00Z" format="relative" /%} ago.'
        tokens = tokenize(text)
        assert has_embed_tags(tokens)
        para = next(t for t in tokens if t["type"] == "paragraph_with_tags")
        tag_children = [c for c in para["children"] if c["type"] == "seer_tag"]
        assert len(tag_children) == 1
        assert tag_children[0]["attrs"]["name"] == "timestamp"
        assert tag_children[0]["attrs"]["attrs"]["format"] == "relative"

    def test_self_closing_tag(self):
        text = '{% docs href="https://docs.sentry.io/" title="Docs" /%}'
        tokens = tokenize(text)
        tag = next(t for t in tokens if t["type"] == "seer_tag")
        assert tag["attrs"]["name"] == "docs"
        assert tag["attrs"]["attrs"]["href"] == "https://docs.sentry.io/"

    def test_code_fence_not_parsed(self):
        text = '```\n{% timestamp value="2026-01-01" /%}\n```'
        tokens = tokenize(text)
        assert not has_embed_tags(tokens)

    def test_mixed_content(self):
        text = (
            "## Title\n\n"
            "Plain paragraph.\n\n"
            '{% thinking %}{"step": 1}{% /thinking %}\n\n'
            'Last seen {% timestamp value="2026-07-15" format="relative" /%}.\n'
        )
        tokens = tokenize(text)
        assert has_embed_tags(tokens)
        types = {t["type"] for t in tokens}
        assert "heading" in types
        assert "paragraph" in types
        assert "seer_tag" in types
        assert "paragraph_with_tags" in types

    def test_json_body_parsing(self):
        text = '{% widget %}{"key": [1, 2, 3]}{% /widget %}'
        tokens = tokenize(text)
        tag = next(t for t in tokens if t["type"] == "seer_tag")
        assert tag["attrs"]["data"] == {"key": [1, 2, 3]}

    def test_non_json_body_returned_as_string(self):
        text = "{% widget %}plain text body{% /widget %}"
        tokens = tokenize(text)
        tag = next(t for t in tokens if t["type"] == "seer_tag")
        assert tag["attrs"]["data"] == "plain text body"
