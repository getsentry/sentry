from sentry.seer.entrypoints.slack.embed_renderer import render_agent_summary


class TestRenderAgentSummary:
    def test_plain_markdown_passthrough(self):
        summary = "Here is a normal response with **no** embeds."
        blocks = render_agent_summary(summary)
        assert len(blocks) == 1
        assert blocks[0].to_dict()["type"] == "markdown"
        assert blocks[0].to_dict()["text"] == summary

    def test_inline_timestamp_absolute(self):
        summary = 'The error appeared {% timestamp value="2026-07-15T14:30:00Z" format="absolute" /%} in production.'
        blocks = render_agent_summary(summary)
        assert len(blocks) == 1
        block = blocks[0].to_dict()
        assert block["type"] == "rich_text"
        elements = block["elements"][0]["elements"]
        assert elements[0] == {"type": "text", "text": "The error appeared "}
        date_el = elements[1]
        assert date_el["type"] == "date"
        assert date_el["format"] == "{date_short} at {time}"
        assert date_el["timestamp"] == 1784125800
        assert elements[2] == {"type": "text", "text": " in production."}

    def test_inline_timestamp_relative(self):
        summary = 'Last seen {% timestamp value="2026-07-15T14:30:00Z" format="relative" /%}.'
        blocks = render_agent_summary(summary)
        block = blocks[0].to_dict()
        date_el = block["elements"][0]["elements"][1]
        assert date_el["format"] == "{ago}"

    def test_inline_docs_link(self):
        summary = (
            'See {% docs href="https://docs.sentry.io/product/issues/" title="Issues" /%} for more.'
        )
        blocks = render_agent_summary(summary)
        block = blocks[0].to_dict()
        elements = block["elements"][0]["elements"]
        link = elements[1]
        assert link["type"] == "link"
        assert link["url"] == "https://docs.sentry.io/product/issues/"
        assert link["text"] == "Issues"

    def test_mixed_tags_and_markdown(self):
        summary = (
            "## Analysis\n\n"
            "Plain paragraph here.\n\n"
            'First seen {% timestamp value="2026-07-15T14:30:00Z" format="relative" /%}.\n\n'
            "### Details\n\n"
            "- Item 1\n- Item 2\n"
        )
        blocks = render_agent_summary(summary)
        types = [b.to_dict()["type"] for b in blocks]
        assert "markdown" in types
        assert "rich_text" in types
        md_texts = [b.to_dict()["text"] for b in blocks if b.to_dict()["type"] == "markdown"]
        combined = "\n\n".join(md_texts)
        assert "## Analysis" in combined
        assert "Plain paragraph here." in combined
        assert "### Details" in combined

    def test_block_level_tag_stripped(self):
        summary = 'Before.\n\n{% thinking %}{"content": "analyzing..."}{% /thinking %}\n\nAfter.'
        blocks = render_agent_summary(summary)
        types = [b.to_dict()["type"] for b in blocks]
        assert all(t == "markdown" for t in types)
        combined = " ".join(b.to_dict()["text"] for b in blocks)
        assert "Before." in combined
        assert "After." in combined
        assert "thinking" not in combined

    def test_code_fence_not_parsed(self):
        summary = (
            "Normal text.\n\n"
            '```python\n# {% timestamp value="2026-01-01" /%}\ndef foo(): pass\n```\n'
        )
        blocks = render_agent_summary(summary)
        types = [b.to_dict()["type"] for b in blocks]
        assert all(t == "markdown" for t in types)
        combined = "\n\n".join(b.to_dict()["text"] for b in blocks)
        assert "{% timestamp" in combined

    def test_unknown_tag_fallback(self):
        summary = 'Found {% unknown-widget value="something" /%} here.'
        blocks = render_agent_summary(summary)
        block = blocks[0].to_dict()
        elements = block["elements"][0]["elements"]
        texts = [e["text"] for e in elements if e["type"] == "text"]
        assert "something" in texts

    def test_multiple_inline_tags(self):
        summary = (
            'Started {% timestamp value="2026-07-15T14:30:00Z" format="relative" /%}'
            ', see {% docs href="https://docs.sentry.io/" title="Docs" /%}.'
        )
        blocks = render_agent_summary(summary)
        block = blocks[0].to_dict()
        elements = block["elements"][0]["elements"]
        types = [e["type"] for e in elements]
        assert "date" in types
        assert "link" in types
