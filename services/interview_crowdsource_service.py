"""Interview Crowdsource Service

This service manages interview questions and sample answers.
"""

from typing import Dict, List, Optional
from uuid import UUID
import uuid


class Question:
    """Represents an interview question."""
    
    def __init__(
        self,
        question_id: str,
        text: str,
        company: Optional[str] = None,
        role: Optional[str] = None,
        difficulty: Optional[str] = None,
        category: Optional[str] = None,
    ):
        self.question_id = question_id
        self.text = text
        self.company = company
        self.role = role
        self.difficulty = difficulty
        self.category = category


class SampleAnswer:
    """Represents a sample answer to a question."""
    
    def __init__(
        self,
        answer_id: str,
        question_id: str,
        answer_text: str,
        approach_explanation: Optional[str] = None,
        time_complexity: Optional[str] = None,
        space_complexity: Optional[str] = None,
        user_id: Optional[str] = None,
    ):
        self.answer_id = answer_id
        self.question_id = question_id
        self.answer_text = answer_text
        self.approach_explanation = approach_explanation
        self.time_complexity = time_complexity
        self.space_complexity = space_complexity
        self.user_id = user_id


class InterviewCrowdsourceService:
    """Service for managing interview questions and crowdsourced answers."""
    
    def __init__(self):
        """Initialize the service with in-memory storage."""
        self._questions: Dict[str, Question] = {}
        self._answers: Dict[str, SampleAnswer] = {}
        self._persistent_questions: Dict[str, Question] = {}
        self._persistent_answers: Dict[str, SampleAnswer] = {}
    
    def _load_question_from_storage(self, question_id: str) -> Optional[Question]:
        """Load a question from persistent storage.
        
        This method simulates loading from a database or persistent storage.
        In a real implementation, this would query a database.
        
        Args:
            question_id: The ID of the question to load
            
        Returns:
            The Question object if found, None otherwise
        """
        # Check persistent storage (simulated)
        question = self._persistent_questions.get(question_id)
        
        if question:
            # Add to cache for faster subsequent access
            self._questions[question_id] = question
        
        return question
    
    def get_question(self, question_id: str) -> Optional[Question]:
        """Get a question by ID.
        
        First checks the cache, then falls back to persistent storage.
        
        Args:
            question_id: The ID of the question to retrieve
            
        Returns:
            The Question object if found, None otherwise
        """
        # Check cache first
        question = self._questions.get(question_id)
        
        # If not in cache, try loading from persistent storage
        if not question:
            question = self._load_question_from_storage(question_id)
        
        return question
    
    def add_question(
        self,
        text: str,
        company: Optional[str] = None,
        role: Optional[str] = None,
        difficulty: Optional[str] = None,
        category: Optional[str] = None,
        question_id: Optional[str] = None,
    ) -> Question:
        """Add a new question to the service.
        
        Args:
            text: The question text
            company: The company associated with the question
            role: The role associated with the question
            difficulty: The difficulty level
            category: The category of the question
            question_id: Optional specific ID for the question
            
        Returns:
            The created Question object
        """
        if question_id is None:
            question_id = str(uuid.uuid4())
        
        question = Question(
            question_id=question_id,
            text=text,
            company=company,
            role=role,
            difficulty=difficulty,
            category=category,
        )
        
        # Store in both cache and persistent storage
        self._questions[question_id] = question
        self._persistent_questions[question_id] = question
        
        return question
    
    def get_questions_by_company(self, company: str) -> List[Question]:
        """Get all questions for a specific company.
        
        Args:
            company: The company name
            
        Returns:
            List of Question objects
        """
        # Search in persistent storage to ensure we get all questions
        questions = [
            q for q in self._persistent_questions.values()
            if q.company and q.company.lower() == company.lower()
        ]
        
        # Also add to cache
        for question in questions:
            self._questions[question.question_id] = question
        
        return questions
    
    def get_questions_by_role(self, role: str) -> List[Question]:
        """Get all questions for a specific role.
        
        Args:
            role: The role name
            
        Returns:
            List of Question objects
        """
        # Search in persistent storage to ensure we get all questions
        questions = [
            q for q in self._persistent_questions.values()
            if q.role and q.role.lower() == role.lower()
        ]
        
        # Also add to cache
        for question in questions:
            self._questions[question.question_id] = question
        
        return questions
    
    def submit_question(
        self,
        text: str,
        company: Optional[str] = None,
        role: Optional[str] = None,
        difficulty: Optional[str] = None,
        category: Optional[str] = None,
    ) -> Question:
        """Submit a new question (alias for add_question).
        
        Args:
            text: The question text
            company: The company associated with the question
            role: The role associated with the question
            difficulty: The difficulty level
            category: The category of the question
            
        Returns:
            The created Question object
        """
        return self.add_question(
            text=text,
            company=company,
            role=role,
            difficulty=difficulty,
            category=category,
        )
    
    def vote_question(
        self,
        question_id: str,
        vote_type: str,
        user_id: Optional[str] = None,
    ) -> bool:
        """Vote on a question.
        
        Args:
            question_id: The ID of the question to vote on
            vote_type: The type of vote (e.g., 'up', 'down')
            user_id: Optional user ID who is voting
            
        Returns:
            True if the vote was successful, False otherwise
        """
        # Check if question exists (this will also load it into cache if needed)
        question = self.get_question(question_id)
        
        if not question:
            return False
        
        # In a real implementation, this would record the vote
        return True
    
    def submit_answer(
        self,
        question_id: str,
        answer: Optional[str] = None,
        answer_text: Optional[str] = None,
        approach: Optional[str] = None,
        approach_explanation: Optional[str] = None,
        time_complexity: Optional[str] = None,
        space_complexity: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> SampleAnswer:
        """Submit a sample answer to a question.
        
        This method now handles the case where a question might not be in the cache
        by attempting to load it from persistent storage before raising an error.
        
        Args:
            question_id: The ID of the question to answer
            answer: The answer text (alternative parameter name)
            answer_text: The answer text
            approach: The approach explanation (alternative parameter name)
            approach_explanation: The approach explanation
            time_complexity: The time complexity of the solution
            space_complexity: The space complexity of the solution
            user_id: Optional user ID who is submitting the answer
            
        Returns:
            The created SampleAnswer object
            
        Raises:
            ValueError: If the question is not found in cache or persistent storage
        """
        # Try to get the question from cache first, then from persistent storage
        question = self.get_question(question_id)
        
        if not question:
            raise ValueError("Question not found")
        
        # Support both answer_text and answer parameters
        actual_answer = answer_text or answer
        actual_approach = approach_explanation or approach
        
        if not actual_answer:
            raise ValueError("Answer text is required")
        
        # Create the sample answer
        answer_id = str(uuid.uuid4())
        sample_answer = SampleAnswer(
            answer_id=answer_id,
            question_id=question_id,
            answer_text=actual_answer,
            approach_explanation=actual_approach,
            time_complexity=time_complexity,
            space_complexity=space_complexity,
            user_id=user_id,
        )
        
        # Store in both cache and persistent storage
        self._answers[answer_id] = sample_answer
        self._persistent_answers[answer_id] = sample_answer
        
        return sample_answer
    
    def get_answers_for_question(self, question_id: str) -> List[SampleAnswer]:
        """Get all answers for a specific question.
        
        Args:
            question_id: The ID of the question
            
        Returns:
            List of SampleAnswer objects
        """
        return [
            answer for answer in self._persistent_answers.values()
            if answer.question_id == question_id
        ]
    
    def clear_cache(self):
        """Clear the in-memory cache.
        
        This is useful for testing or when memory needs to be freed.
        The persistent storage remains intact.
        """
        self._questions.clear()
        self._answers.clear()
