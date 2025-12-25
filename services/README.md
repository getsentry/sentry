# Services

This directory contains service layer implementations for the application.

## InterviewCrowdsourceService

A service for managing interview questions and crowdsourced answers.

### Features

- Two-tier storage architecture (in-memory cache + persistent storage)
- Automatic cache warming on access
- Graceful handling of cache clearing
- Support for filtering questions by company and role
- Voting and answer submission functionality

### Usage

```python
from services.interview_crowdsource_service import InterviewCrowdsourceService

# Initialize the service
service = InterviewCrowdsourceService()

# Add a question
question = service.add_question(
    text="Describe your experience with distributed systems",
    company="Google",
    role="Software Engineer",
)

# Submit an answer (works even if question is not in cache)
answer = service.submit_answer(
    question_id=question.question_id,
    answer="I have extensive experience...",
)
```

### Bug Fix

This implementation fixes the "ValueError: Question not found" issue by:

1. Implementing a two-tier storage pattern (cache + persistent storage)
2. Automatically loading questions from persistent storage when not in cache
3. Warming the cache on access to improve future performance
4. Only raising "Question not found" when the question truly doesn't exist

See `FIX_SUMMARY.md` in the root directory for detailed information.

### Testing

Run the test suite:

```bash
python3 -m pytest tests/services/test_interview_crowdsource_service.py -v
```

Or use the Makefile:

```bash
make test-python-ci
```
