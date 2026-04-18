from __future__ import annotations

import tempfile
from pathlib import Path
from unittest import mock

from django.test import override_settings
from django.urls import reverse

from sentry.conf.server import SENTRY_EARLY_FEATURES
from sentry.testutils.cases import APITestCase

EARLY_FEATURE_FLAG = next(iter(SENTRY_EARLY_FEATURES))


class TestInternalFeatureFlagsEndpoint(APITestCase):
    url = reverse("sentry-api-0-internal-feature-flags")

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_get_not_self_hosted(self) -> None:
        user = self.create_user(is_superuser=True)
        self.login_as(user=user, superuser=True)
        response = self.client.get(self.url)
        assert response.status_code == 403

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_put_not_self_hosted(self) -> None:
        user = self.create_user(is_superuser=True)
        self.login_as(user=user, superuser=True)
        response = self.client.put(self.url, {EARLY_FEATURE_FLAG: True}, format="json")
        assert response.status_code == 403

    @override_settings(SENTRY_SELF_HOSTED=True)
    def test_put_not_superuser(self) -> None:
        self.login_as(user=self.user, superuser=False)
        response = self.client.put(self.url, {EARLY_FEATURE_FLAG: True}, format="json")
        assert response.status_code == 403

    @override_settings(SENTRY_SELF_HOSTED=True)
    def test_put_string_value_returns_400(self) -> None:
        user = self.create_user(is_superuser=True)
        self.login_as(user=user, superuser=True)
        initial = "# sentry config placeholder\n"
        with tempfile.NamedTemporaryFile(
            mode="w", suffix="sentry.conf.py", delete=False, encoding="utf-8"
        ) as tmp:
            tmp.write(initial)
            py_path = tmp.name
        py_file = Path(py_path)
        try:
            with mock.patch(
                "sentry.api.endpoints.internal.feature_flags.discover_configs",
                return_value=(str(py_file.parent), str(py_file), None),
            ) as discover_mock:
                response = self.client.put(
                    self.url,
                    {EARLY_FEATURE_FLAG: "__import__('os').popen('id').read()"},
                    format="json",
                )

            assert response.status_code == 400
            assert "true or false" in response.data["detail"]
            discover_mock.assert_not_called()
            assert py_file.read_text() == initial
        finally:
            py_file.unlink(missing_ok=True)

    @override_settings(SENTRY_SELF_HOSTED=True)
    def test_put_int_other_than_zero_or_one_returns_400(self) -> None:
        user = self.create_user(is_superuser=True)
        self.login_as(user=user, superuser=True)
        initial = "# sentry config placeholder\n"
        with tempfile.NamedTemporaryFile(
            mode="w", suffix="sentry.conf.py", delete=False, encoding="utf-8"
        ) as tmp:
            tmp.write(initial)
            py_path = tmp.name
        py_file = Path(py_path)
        try:
            with mock.patch(
                "sentry.api.endpoints.internal.feature_flags.discover_configs",
                return_value=(str(py_file.parent), str(py_file), None),
            ) as discover_mock:
                response = self.client.put(self.url, {EARLY_FEATURE_FLAG: 2}, format="json")

            assert response.status_code == 400
            discover_mock.assert_not_called()
            assert py_file.read_text() == initial
        finally:
            py_file.unlink(missing_ok=True)

    @override_settings(SENTRY_SELF_HOSTED=True)
    def test_put_int_one_writes_true_literal(self) -> None:
        user = self.create_user(is_superuser=True)
        self.login_as(user=user, superuser=True)
        with tempfile.NamedTemporaryFile(
            mode="w", suffix="sentry.conf.py", delete=False, encoding="utf-8"
        ) as tmp:
            tmp.write("# empty\n")
            py_path = tmp.name
        py_file = Path(py_path)
        try:
            with (
                mock.patch(
                    "sentry.api.endpoints.internal.feature_flags.discover_configs",
                    return_value=(str(py_file.parent), str(py_file), None),
                ),
                mock.patch("sentry.api.endpoints.internal.feature_flags.configure"),
            ):
                response = self.client.put(self.url, {EARLY_FEATURE_FLAG: 1}, format="json")

            assert response.status_code == 200
            written = py_file.read_text().replace(" ", "")
            assert f'SENTRY_FEATURES["{EARLY_FEATURE_FLAG}"]=True' in written
        finally:
            py_file.unlink(missing_ok=True)

    @override_settings(SENTRY_SELF_HOSTED=True)
    def test_put_int_zero_writes_false_literal(self) -> None:
        user = self.create_user(is_superuser=True)
        self.login_as(user=user, superuser=True)
        with tempfile.NamedTemporaryFile(
            mode="w", suffix="sentry.conf.py", delete=False, encoding="utf-8"
        ) as tmp:
            tmp.write("# empty\n")
            py_path = tmp.name
        py_file = Path(py_path)
        try:
            with (
                mock.patch(
                    "sentry.api.endpoints.internal.feature_flags.discover_configs",
                    return_value=(str(py_file.parent), str(py_file), None),
                ),
                mock.patch("sentry.api.endpoints.internal.feature_flags.configure"),
            ):
                response = self.client.put(self.url, {EARLY_FEATURE_FLAG: 0}, format="json")

            assert response.status_code == 200
            written = py_file.read_text().replace(" ", "")
            assert f'SENTRY_FEATURES["{EARLY_FEATURE_FLAG}"]=False' in written
        finally:
            py_file.unlink(missing_ok=True)

    @override_settings(SENTRY_SELF_HOSTED=True)
    def test_put_string_true_writes_true_literal(self) -> None:
        user = self.create_user(is_superuser=True)
        self.login_as(user=user, superuser=True)
        with tempfile.NamedTemporaryFile(
            mode="w", suffix="sentry.conf.py", delete=False, encoding="utf-8"
        ) as tmp:
            tmp.write("# empty\n")
            py_path = tmp.name
        py_file = Path(py_path)
        try:
            with (
                mock.patch(
                    "sentry.api.endpoints.internal.feature_flags.discover_configs",
                    return_value=(str(py_file.parent), str(py_file), None),
                ),
                mock.patch("sentry.api.endpoints.internal.feature_flags.configure"),
            ):
                response = self.client.put(self.url, {EARLY_FEATURE_FLAG: "true"}, format="json")

            assert response.status_code == 200
            written = py_file.read_text().replace(" ", "")
            assert f'SENTRY_FEATURES["{EARLY_FEATURE_FLAG}"]=True' in written
        finally:
            py_file.unlink(missing_ok=True)

    @override_settings(SENTRY_SELF_HOSTED=True)
    def test_put_string_false_writes_false_literal(self) -> None:
        user = self.create_user(is_superuser=True)
        self.login_as(user=user, superuser=True)
        with tempfile.NamedTemporaryFile(
            mode="w", suffix="sentry.conf.py", delete=False, encoding="utf-8"
        ) as tmp:
            tmp.write("# empty\n")
            py_path = tmp.name
        py_file = Path(py_path)
        try:
            with (
                mock.patch(
                    "sentry.api.endpoints.internal.feature_flags.discover_configs",
                    return_value=(str(py_file.parent), str(py_file), None),
                ),
                mock.patch("sentry.api.endpoints.internal.feature_flags.configure"),
            ):
                response = self.client.put(self.url, {EARLY_FEATURE_FLAG: "FALSE"}, format="json")

            assert response.status_code == 200
            written = py_file.read_text().replace(" ", "")
            assert f'SENTRY_FEATURES["{EARLY_FEATURE_FLAG}"]=False' in written
        finally:
            py_file.unlink(missing_ok=True)

    @override_settings(SENTRY_SELF_HOSTED=True)
    def test_put_string_other_than_true_false_returns_400(self) -> None:
        user = self.create_user(is_superuser=True)
        self.login_as(user=user, superuser=True)
        initial = "# sentry config placeholder\n"
        with tempfile.NamedTemporaryFile(
            mode="w", suffix="sentry.conf.py", delete=False, encoding="utf-8"
        ) as tmp:
            tmp.write(initial)
            py_path = tmp.name
        py_file = Path(py_path)
        try:
            with mock.patch(
                "sentry.api.endpoints.internal.feature_flags.discover_configs",
                return_value=(str(py_file.parent), str(py_file), None),
            ) as discover_mock:
                response = self.client.put(self.url, {EARLY_FEATURE_FLAG: "yes"}, format="json")

            assert response.status_code == 400
            discover_mock.assert_not_called()
            assert py_file.read_text() == initial
        finally:
            py_file.unlink(missing_ok=True)

    @override_settings(SENTRY_SELF_HOSTED=True)
    def test_put_boolean_writes_safe_literal(self) -> None:
        user = self.create_user(is_superuser=True)
        self.login_as(user=user, superuser=True)
        with tempfile.NamedTemporaryFile(
            mode="w", suffix="sentry.conf.py", delete=False, encoding="utf-8"
        ) as tmp:
            tmp.write("# empty\n")
            py_path = tmp.name
        py_file = Path(py_path)
        try:
            with (
                mock.patch(
                    "sentry.api.endpoints.internal.feature_flags.discover_configs",
                    return_value=(str(py_file.parent), str(py_file), None),
                ),
                mock.patch("sentry.api.endpoints.internal.feature_flags.configure"),
            ):
                response = self.client.put(self.url, {EARLY_FEATURE_FLAG: True}, format="json")

            assert response.status_code == 200
            written = py_file.read_text()
            assert f'SENTRY_FEATURES["{EARLY_FEATURE_FLAG}"]=True' in written.replace(" ", "")
            assert "__import__" not in written
        finally:
            py_file.unlink(missing_ok=True)

    @override_settings(SENTRY_SELF_HOSTED=True)
    def test_put_non_object_payload_returns_400(self) -> None:
        user = self.create_user(is_superuser=True)
        self.login_as(user=user, superuser=True)
        response = self.client.put(self.url, [EARLY_FEATURE_FLAG], format="json")
        assert response.status_code == 400
