from sentry.feedback.lib.html_tree import html_to_tree


def test_nested_elements() -> None:
    assert html_to_tree('<div class="a" role="dialog"><p>One <b>two</b></p>three</div>') == [
        [
            "div",
            {"class": "a", "role": "dialog"},
            [["p", {}, ["One ", ["b", {}, ["two"]]]], "three"],
        ]
    ]


def test_void_elements_and_boolean_attributes() -> None:
    assert html_to_tree('<input name="a" required><input name="b" /><p></p>') == [
        ["input", {"name": "a", "required": ""}, []],
        ["input", {"name": "b"}, []],
        ["p", {}, []],
    ]


def test_escaped_markup_stays_text() -> None:
    assert html_to_tree('<p title="&quot;&lt;">&lt;img src=x&gt; &#x27;&amp;</p>') == [
        ["p", {"title": '"<'}, ["<img src=x> '&"]]
    ]


def test_style_content_is_raw_text() -> None:
    assert html_to_tree("<style>a > b { content: '&lt;' }</style>") == [
        ["style", {}, ["a > b { content: '&lt;' }"]]
    ]


def test_textarea_drops_first_newline() -> None:
    assert html_to_tree("<textarea>\r\n</textarea>") == [["textarea", {}, []]]
    assert html_to_tree("<textarea>\n\na</textarea>") == [["textarea", {}, ["\na"]]]


def test_comments_are_ignored() -> None:
    assert html_to_tree("<p>a<!-- b --></p>") == [["p", {}, ["a"]]]
