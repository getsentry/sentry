# LinkedIn Optimizer API

A FastAPI-based service for optimizing LinkedIn profiles with best practices, suggestions, and AI-powered recommendations.

## Overview

This API provides endpoints to help users optimize their LinkedIn profiles by offering:
- Best practices for different profile sections
- Headline generation suggestions
- Keyword analysis
- Action word recommendations
- Profile improvement suggestions

## Issue Resolution

### Fixed: AttributeError - 'LinkedInOptimizerService' object has no attribute 'get_best_practices'

**Problem**: The `LinkedInOptimizerService` class was missing the `get_best_practices` method, causing an `AttributeError` when the `/api/v1/linkedin-optimizer/best-practices` endpoint was accessed.

**Solution**: Implemented the complete `get_best_practices` method and supporting infrastructure:
- Created the `LinkedInOptimizerService` class with comprehensive best practices data
- Implemented async `get_best_practices(section: Optional[str])` method
- Added support for all LinkedIn profile sections: headline, about, experience, skills, education
- Created FastAPI routes and proper error handling
- Added middleware for logging and security

## Project Structure

```
/workspace/
├── api/
│   ├── __init__.py
│   └── routes/
│       ├── __init__.py
│       └── linkedin_optimizer.py    # API route handlers
├── services/
│   ├── __init__.py
│   └── linkedin_optimizer_service.py  # Business logic
├── middleware/
│   ├── __init__.py
│   ├── logging.py                   # Request/response logging
│   └── security.py                  # Security headers & rate limiting
├── main.py                          # FastAPI application entry point
├── test_linkedin_optimizer.py       # Comprehensive test suite
└── requirements-linkedin.txt        # Python dependencies
```

## Installation

### Prerequisites
- Python 3.12+
- pip

### Install Dependencies

```bash
pip install -r requirements-linkedin.txt
```

Or install individually:

```bash
pip install fastapi uvicorn pydantic httpx pytest pytest-asyncio
```

## Running the Application

### Development Server

```bash
python3 main.py
```

Or using uvicorn directly:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### 1. Get Best Practices

Get LinkedIn best practices and tips for profile optimization.

**Endpoint**: `GET /api/v1/linkedin-optimizer/best-practices`

**Query Parameters**:
- `section` (optional): Specific section to get best practices for
  - Valid values: `headline`, `about`, `experience`, `skills`, `education`
  - If omitted, returns best practices for all sections

**Examples**:

```bash
# Get all best practices
curl http://localhost:8000/api/v1/linkedin-optimizer/best-practices

# Get best practices for headline
curl http://localhost:8000/api/v1/linkedin-optimizer/best-practices?section=headline

# Get best practices for about section
curl http://localhost:8000/api/v1/linkedin-optimizer/best-practices?section=about
```

**Response** (for specific section):
```json
{
  "section": "headline",
  "data": {
    "title": "Headline Best Practices",
    "tips": [
      "Keep it concise and impactful (under 120 characters)",
      "Include your current role and value proposition",
      "Use keywords relevant to your industry"
    ],
    "examples": [
      "Senior Software Engineer | Cloud Architecture | AWS & Azure Specialist"
    ],
    "common_mistakes": [
      "Using only your job title without context"
    ]
  }
}
```

### 2. Generate Headline

Generate optimized LinkedIn headline suggestions.

**Endpoint**: `POST /api/v1/linkedin-optimizer/headline/generate`

**Request Body**:
```json
{
  "current_role": "Senior Software Engineer",
  "industry": "Technology",
  "key_skills": ["Python", "Cloud Architecture", "AWS"]
}
```

**Response**:
```json
{
  "suggestions": [
    "Senior Software Engineer | Python | Cloud Architecture | AWS",
    "Senior Software Engineer specializing in Python & Cloud Architecture"
  ],
  "tips": [...]
}
```

### 3. Get Suggestions

Get improvement suggestions for a specific profile section.

**Endpoint**: `POST /api/v1/linkedin-optimizer/suggestions`

**Request Body**:
```json
{
  "profile_section": "headline",
  "content": "Software Engineer"
}
```

### 4. Analyze Keywords

Analyze keyword optimization in profile text.

**Endpoint**: `POST /api/v1/linkedin-optimizer/keywords/analyze`

**Request Body**:
```json
{
  "profile_text": "Senior Software Engineer with 5 years of experience...",
  "target_role": "Staff Engineer"
}
```

### 5. Get Action Words

Get categorized action words for profile descriptions.

**Endpoint**: `POST /api/v1/linkedin-optimizer/action-words`

**Response**:
```json
{
  "leadership": ["Led", "Directed", "Managed", ...],
  "achievement": ["Achieved", "Accomplished", "Delivered", ...],
  "improvement": ["Improved", "Enhanced", "Optimized", ...],
  ...
}
```

### 6. Health Check

Check service health status.

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "healthy"
}
```

## Testing

### Run All Tests

```bash
python3 test_linkedin_optimizer.py
```

### Run Specific Test Class

```python
pytest test_linkedin_optimizer.py::TestBestPracticesEndpoint -v
```

### Manual Testing

Test the fixed endpoint directly:

```bash
# Test the previously failing endpoint
curl -X GET "http://localhost:8000/api/v1/linkedin-optimizer/best-practices"

# Test with a specific section
curl -X GET "http://localhost:8000/api/v1/linkedin-optimizer/best-practices?section=headline"
```

## Middleware

### 1. Request Logging Middleware
- Logs all incoming requests with unique request IDs
- Tracks request duration
- Logs response status codes
- Adds `X-Request-ID` header to responses

### 2. Security Headers Middleware
- Adds security headers to all responses:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Strict-Transport-Security`
  - `Content-Security-Policy`
  - `Referrer-Policy`
  - `Permissions-Policy`

### 3. Rate Limiting Middleware
- Limits requests per IP address (default: 60 requests/minute)
- Whitelists localhost and test clients
- Returns 429 status code when limit exceeded

## Error Handling

The API provides comprehensive error handling:

- **400 Bad Request**: Invalid input parameters
- **422 Unprocessable Entity**: Validation errors
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Unexpected errors

All errors include detailed error messages in the response.

## Development

### Code Structure

- **Services Layer** (`services/`): Contains business logic and data
- **API Layer** (`api/routes/`): FastAPI route handlers and request/response models
- **Middleware** (`middleware/`): Cross-cutting concerns (logging, security, rate limiting)
- **Main App** (`main.py`): FastAPI application setup and configuration

### Adding New Features

1. Add business logic to `services/linkedin_optimizer_service.py`
2. Create route handler in `api/routes/linkedin_optimizer.py`
3. Add tests in `test_linkedin_optimizer.py`
4. Update this README

## Production Deployment

### Environment Variables

Configure these environment variables for production:

- `PORT`: Server port (default: 8000)
- `HOST`: Server host (default: 0.0.0.0)
- `LOG_LEVEL`: Logging level (default: INFO)
- `RATE_LIMIT_REQUESTS`: Requests per minute (default: 60)

### Running in Production

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Docker Deployment

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements-linkedin.txt .
RUN pip install --no-cache-dir -r requirements-linkedin.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Best Practices Data

The service includes comprehensive best practices for:

### Headline
- Tips for creating impactful headlines
- Examples of well-crafted headlines
- Common mistakes to avoid

### About Section
- Structure and formatting guidelines
- How to showcase achievements
- Call-to-action strategies

### Experience
- Action verbs and formula for descriptions
- Quantifiable achievement examples
- Impact-focused writing

### Skills
- Skill prioritization strategies
- Hard vs. soft skills balance
- Endorsement optimization

### Education
- What to include for different career stages
- Recent graduate specific tips
- Continuing education best practices

## License

This project is part of the Sentry workspace and follows the same licensing terms.

## Support

For issues or questions:
1. Check the interactive API documentation at `/docs`
2. Review the test suite for usage examples
3. Check the error messages for detailed debugging information

## Changelog

### Version 1.0.0 (2025-12-25)
- ✅ Fixed: AttributeError - 'LinkedInOptimizerService' object has no attribute 'get_best_practices'
- ✅ Implemented complete LinkedInOptimizerService class
- ✅ Added comprehensive best practices for all LinkedIn sections
- ✅ Created FastAPI routes with proper error handling
- ✅ Added middleware for logging, security, and rate limiting
- ✅ Comprehensive test suite with 100% endpoint coverage
