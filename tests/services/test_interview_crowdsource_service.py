"""Tests for InterviewCrowdsourceService.

This test suite verifies that the service correctly handles the case where
a question is submitted and then answered, even if the question is not in
the in-memory cache.
"""

import pytest
from services.interview_crowdsource_service import (
    InterviewCrowdsourceService,
    Question,
    SampleAnswer,
)


class TestInterviewCrowdsourceService:
    """Test suite for InterviewCrowdsourceService."""
    
    def test_submit_answer_with_question_in_cache(self):
        """Test submitting an answer when question is in cache."""
        service = InterviewCrowdsourceService()
        
        # Add a question
        question = service.add_question(
            text="Describe your experience with distributed systems",
            company="Google",
            role="Software Engineer",
        )
        
        # Submit an answer - question is in cache
        answer = service.submit_answer(
            question_id=question.question_id,
            answer="I have extensive experience building distributed systems using microservices patterns and event-driven architectures.",
        )
        
        assert answer is not None
        assert answer.question_id == question.question_id
        assert "distributed systems" in answer.answer_text
    
    def test_submit_answer_with_question_not_in_cache(self):
        """Test submitting an answer when question is not in cache but exists in storage.
        
        This test reproduces the bug scenario where:
        1. A question is added to the service (stored in persistent storage)
        2. The cache is cleared (simulating memory pressure or service restart)
        3. An answer is submitted for that question
        4. The service should load the question from persistent storage
        """
        service = InterviewCrowdsourceService()
        
        # Add a question
        question = service.add_question(
            text="Describe your experience with distributed systems",
            company="Google",
            role="Software Engineer",
        )
        question_id = question.question_id
        
        # Clear the cache to simulate the bug scenario
        service.clear_cache()
        
        # Verify question is not in cache
        assert question_id not in service._questions
        
        # But still exists in persistent storage
        assert question_id in service._persistent_questions
        
        # Submit an answer - this should NOT raise ValueError
        # The service should load the question from persistent storage
        answer = service.submit_answer(
            question_id=question_id,
            answer="I have extensive experience building distributed systems using microservices patterns and event-driven architectures.",
        )
        
        assert answer is not None
        assert answer.question_id == question_id
        assert "distributed systems" in answer.answer_text
        
        # Verify the question was loaded back into cache
        assert question_id in service._questions
    
    def test_submit_answer_with_nonexistent_question(self):
        """Test submitting an answer for a question that doesn't exist."""
        service = InterviewCrowdsourceService()
        
        # Try to submit an answer for a non-existent question
        with pytest.raises(ValueError, match="Question not found"):
            service.submit_answer(
                question_id="nonexistent-id",
                answer="This should fail",
            )
    
    def test_submit_answer_with_empty_answer(self):
        """Test submitting an empty answer."""
        service = InterviewCrowdsourceService()
        
        # Add a question
        question = service.add_question(
            text="Describe your experience with distributed systems",
            company="Google",
            role="Software Engineer",
        )
        
        # Try to submit an empty answer
        with pytest.raises(ValueError, match="Answer text is required"):
            service.submit_answer(
                question_id=question.question_id,
                answer="",
            )
    
    def test_submit_answer_supports_both_parameter_names(self):
        """Test that submit_answer supports both 'answer' and 'answer_text' parameters."""
        service = InterviewCrowdsourceService()
        
        # Add a question
        question = service.add_question(
            text="Describe your experience",
            company="Google",
        )
        
        # Test with 'answer' parameter
        answer1 = service.submit_answer(
            question_id=question.question_id,
            answer="Test answer 1",
        )
        assert answer1.answer_text == "Test answer 1"
        
        # Clear cache to test loading from storage
        service.clear_cache()
        
        # Test with 'answer_text' parameter
        answer2 = service.submit_answer(
            question_id=question.question_id,
            answer_text="Test answer 2",
        )
        assert answer2.answer_text == "Test answer 2"
    
    def test_get_question_loads_from_storage_if_not_in_cache(self):
        """Test that get_question loads from persistent storage if not in cache."""
        service = InterviewCrowdsourceService()
        
        # Add a question
        question = service.add_question(
            text="Test question",
            company="Google",
        )
        question_id = question.question_id
        
        # Clear cache
        service.clear_cache()
        
        # Get the question - should load from storage
        retrieved_question = service.get_question(question_id)
        
        assert retrieved_question is not None
        assert retrieved_question.question_id == question_id
        assert retrieved_question.text == "Test question"
        
        # Verify it's now in cache
        assert question_id in service._questions
    
    def test_get_questions_by_company_loads_into_cache(self):
        """Test that getting questions by company loads them into cache."""
        service = InterviewCrowdsourceService()
        
        # Add questions
        q1 = service.add_question(
            text="Question 1",
            company="Google",
        )
        q2 = service.add_question(
            text="Question 2",
            company="Google",
        )
        q3 = service.add_question(
            text="Question 3",
            company="Microsoft",
        )
        
        # Clear cache
        service.clear_cache()
        
        # Get questions by company
        google_questions = service.get_questions_by_company("Google")
        
        assert len(google_questions) == 2
        
        # Verify they're now in cache
        assert q1.question_id in service._questions
        assert q2.question_id in service._questions
        assert q3.question_id not in service._questions
    
    def test_vote_question_loads_question_if_needed(self):
        """Test that voting on a question loads it from storage if needed."""
        service = InterviewCrowdsourceService()
        
        # Add a question
        question = service.add_question(
            text="Test question",
            company="Google",
        )
        question_id = question.question_id
        
        # Clear cache
        service.clear_cache()
        
        # Vote on the question - should succeed by loading from storage
        result = service.vote_question(question_id, "up")
        
        assert result is True
        assert question_id in service._questions
    
    def test_full_workflow_with_cache_clearing(self):
        """Test the full workflow that reproduces the original bug.
        
        This simulates the exact scenario from the error trace:
        1. Get questions by company (loads into cache)
        2. Get questions by role (loads into cache)
        3. Submit a question (adds to cache)
        4. Vote on a question (keeps in cache)
        5. Clear cache (simulates service restart or memory pressure)
        6. Submit an answer (should work by loading from storage)
        """
        service = InterviewCrowdsourceService()
        
        # Step 1: Get questions by company
        google_questions = service.get_questions_by_company("Google")
        
        # Step 2: Get questions by role
        engineer_questions = service.get_questions_by_role("Software Engineer")
        
        # Step 3: Submit a question
        question = service.submit_question(
            text="Describe your experience with distributed systems",
            company="Google",
            role="Software Engineer",
        )
        question_id = question.question_id
        
        # Step 4: Vote on the question
        service.vote_question(question_id, "up")
        
        # Step 5: Clear cache (simulates the bug condition)
        service.clear_cache()
        
        # Step 6: Submit an answer - this was failing before the fix
        answer = service.submit_answer(
            question_id=question_id,
            answer="I have extensive experience building distributed systems using microservices patterns and event-driven architectures.",
        )
        
        # Verify the answer was created successfully
        assert answer is not None
        assert answer.question_id == question_id
        assert "distributed systems" in answer.answer_text


class TestQuestionModel:
    """Test suite for Question model."""
    
    def test_question_creation(self):
        """Test creating a Question object."""
        question = Question(
            question_id="test-id",
            text="Test question",
            company="Google",
            role="Software Engineer",
            difficulty="Medium",
            category="System Design",
        )
        
        assert question.question_id == "test-id"
        assert question.text == "Test question"
        assert question.company == "Google"
        assert question.role == "Software Engineer"
        assert question.difficulty == "Medium"
        assert question.category == "System Design"


class TestSampleAnswerModel:
    """Test suite for SampleAnswer model."""
    
    def test_sample_answer_creation(self):
        """Test creating a SampleAnswer object."""
        answer = SampleAnswer(
            answer_id="answer-id",
            question_id="question-id",
            answer_text="Test answer",
            approach_explanation="Test approach",
            time_complexity="O(n)",
            space_complexity="O(1)",
            user_id="user-123",
        )
        
        assert answer.answer_id == "answer-id"
        assert answer.question_id == "question-id"
        assert answer.answer_text == "Test answer"
        assert answer.approach_explanation == "Test approach"
        assert answer.time_complexity == "O(n)"
        assert answer.space_complexity == "O(1)"
        assert answer.user_id == "user-123"
