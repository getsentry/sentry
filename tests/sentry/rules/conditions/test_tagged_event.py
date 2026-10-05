import pytest

from sentry.rules.conditions.tagged_event import TaggedEventCondition, TaggedEventForm
from sentry.rules.match import MatchType
from sentry.testutils.cases import RuleTestCase


class TaggedEventConditionTest(RuleTestCase):
    rule_cls = TaggedEventCondition

    def test_render_label(self) -> None:
        rule = self.get_rule(data={"match": MatchType.EQUAL, "key": "\xc3", "value": "\xc4"})
        assert rule.render_label() == "The event's tags match \xc3 equals \xc4"


@pytest.mark.parametrize("key", ["browser", "my.custom-tag", "sentry:release"])
def test_tagged_event_form_accepts_valid_keys(key: str) -> None:
    form = TaggedEventForm(data={"key": key, "match": MatchType.IS_SET})
    assert form.is_valid(), form.errors


@pytest.mark.parametrize("key", ["flags[use-iframe-in-sidebar]", "tags[browser]", "a[b]"])
def test_tagged_event_form_rejects_bracket_keys(key: str) -> None:
    form = TaggedEventForm(data={"key": key, "match": MatchType.IS_SET})
    assert not form.is_valid()
    assert "key" in form.errors
