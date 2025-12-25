"""Tests for LinkedIn Optimizer API."""

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestBestPracticesEndpoint:
    """Tests for the best-practices endpoint."""

    def test_get_all_best_practices(self):
        """Test getting best practices for all sections."""
        response = client.get("/api/v1/linkedin-optimizer/best-practices")
        assert response.status_code == 200

        data = response.json()
        assert "sections" in data
        assert "data" in data
        assert "general_tips" in data

        # Verify all expected sections are present
        expected_sections = {"headline", "about", "experience", "skills", "education"}
        assert set(data["sections"]) == expected_sections

    def test_get_headline_best_practices(self):
        """Test getting best practices for headline section."""
        response = client.get(
            "/api/v1/linkedin-optimizer/best-practices",
            params={"section": "headline"}
        )
        assert response.status_code == 200

        data = response.json()
        assert data["section"] == "headline"
        assert "data" in data
        assert "tips" in data["data"]
        assert "examples" in data["data"]
        assert "common_mistakes" in data["data"]

    def test_get_about_best_practices(self):
        """Test getting best practices for about section."""
        response = client.get(
            "/api/v1/linkedin-optimizer/best-practices",
            params={"section": "about"}
        )
        assert response.status_code == 200

        data = response.json()
        assert data["section"] == "about"
        assert "data" in data
        assert "tips" in data["data"]
        assert "structure" in data["data"]

    def test_get_experience_best_practices(self):
        """Test getting best practices for experience section."""
        response = client.get(
            "/api/v1/linkedin-optimizer/best-practices",
            params={"section": "experience"}
        )
        assert response.status_code == 200

        data = response.json()
        assert data["section"] == "experience"
        assert "data" in data
        assert "action_verbs" in data["data"]
        assert "formula" in data["data"]

    def test_get_skills_best_practices(self):
        """Test getting best practices for skills section."""
        response = client.get(
            "/api/v1/linkedin-optimizer/best-practices",
            params={"section": "skills"}
        )
        assert response.status_code == 200

        data = response.json()
        assert data["section"] == "skills"
        assert "data" in data
        assert "skill_types" in data["data"]

    def test_get_education_best_practices(self):
        """Test getting best practices for education section."""
        response = client.get(
            "/api/v1/linkedin-optimizer/best-practices",
            params={"section": "education"}
        )
        assert response.status_code == 200

        data = response.json()
        assert data["section"] == "education"
        assert "data" in data
        assert "what_to_include" in data["data"]

    def test_invalid_section(self):
        """Test requesting an invalid section returns 400."""
        response = client.get(
            "/api/v1/linkedin-optimizer/best-practices",
            params={"section": "invalid_section"}
        )
        assert response.status_code == 422  # FastAPI validation error


class TestHeadlineGeneration:
    """Tests for headline generation endpoint."""

    def test_generate_headline(self):
        """Test generating headline suggestions."""
        response = client.post(
            "/api/v1/linkedin-optimizer/headline/generate",
            json={
                "current_role": "Senior Software Engineer",
                "industry": "Technology",
                "key_skills": ["Python", "Cloud Architecture", "AWS"]
            }
        )
        assert response.status_code == 200

        data = response.json()
        assert "suggestions" in data
        assert "tips" in data
        assert len(data["suggestions"]) > 0

    def test_generate_headline_missing_fields(self):
        """Test headline generation with missing required fields."""
        response = client.post(
            "/api/v1/linkedin-optimizer/headline/generate",
            json={
                "current_role": "Engineer"
                # Missing industry and key_skills
            }
        )
        assert response.status_code == 422  # Validation error


class TestSuggestions:
    """Tests for suggestions endpoint."""

    def test_get_suggestions(self):
        """Test getting suggestions for a profile section."""
        response = client.post(
            "/api/v1/linkedin-optimizer/suggestions",
            json={
                "profile_section": "headline",
                "content": "Software Engineer"
            }
        )
        assert response.status_code == 200

        data = response.json()
        assert "section" in data
        assert "suggestions" in data
        assert "recommendations" in data


class TestKeywordAnalysis:
    """Tests for keyword analysis endpoint."""

    def test_analyze_keywords(self):
        """Test analyzing keywords in profile text."""
        response = client.post(
            "/api/v1/linkedin-optimizer/keywords/analyze",
            json={
                "profile_text": "Senior Software Engineer with 5 years of experience...",
                "target_role": "Staff Engineer"
            }
        )
        assert response.status_code == 200

        data = response.json()
        assert "word_count" in data
        assert "target_role" in data
        assert "optimization_score" in data
        assert "recommendations" in data


class TestActionWords:
    """Tests for action words endpoint."""

    def test_get_action_words(self):
        """Test getting categorized action words."""
        response = client.post("/api/v1/linkedin-optimizer/action-words")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, dict)
        assert "leadership" in data
        assert "achievement" in data
        assert "improvement" in data
        assert "creation" in data

        # Verify each category has action words
        for category, words in data.items():
            assert isinstance(words, list)
            assert len(words) > 0


class TestHealthCheck:
    """Tests for health check endpoints."""

    def test_root_endpoint(self):
        """Test root endpoint."""
        response = client.get("/")
        assert response.status_code == 200

        data = response.json()
        assert "message" in data
        assert "version" in data

    def test_health_check(self):
        """Test health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "healthy"

    def test_linkedin_optimizer_health(self):
        """Test LinkedIn optimizer health endpoint."""
        response = client.get("/api/v1/linkedin-optimizer/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "linkedin-optimizer"


class TestMiddleware:
    """Tests for middleware functionality."""

    def test_security_headers(self):
        """Test that security headers are added to responses."""
        response = client.get("/health")
        assert response.status_code == 200

        # Check security headers
        assert "X-Content-Type-Options" in response.headers
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert "X-Frame-Options" in response.headers
        assert "X-XSS-Protection" in response.headers
        assert "Strict-Transport-Security" in response.headers

    def test_request_id_header(self):
        """Test that request ID is added to responses."""
        response = client.get("/health")
        assert response.status_code == 200
        assert "X-Request-ID" in response.headers


if __name__ == "__main__":
    # Run all tests
    pytest.main([__file__, "-v"])
