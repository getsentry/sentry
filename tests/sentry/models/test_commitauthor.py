from typing import int
from django.test import SimpleTestCase

from sentry.models.commitauthor import CommitAuthor


class CommitAuthorUsernameExtractionTest(SimpleTestCase):
    def test_get_username_from_external_id(self) -> None:
        author = CommitAuthor(external_id="github:baxterthehacker")
        assert author.get_username_from_external_id() == "baxterthehacker"

    def test_get_username_from_external_id_no_external_id(self) -> None:
        author = CommitAuthor(external_id=None)
        assert author.get_username_from_external_id() is None

    def test_get_username_from_external_id_empty_external_id(self) -> None:
        author = CommitAuthor(external_id="")
        assert author.get_username_from_external_id() is None

    def test_get_username_from_external_id_no_colon(self) -> None:
        author = CommitAuthor(external_id="justausername")
        assert author.get_username_from_external_id() is None

    def test_get_username_from_external_id_multiple_colons(self) -> None:
        author = CommitAuthor(external_id="provider:user:with:colons")
        assert author.get_username_from_external_id() == "user:with:colons"
