"""
Embedding service for semantic job search.

This module provides functionality for generating embeddings from text
and searching for similar jobs using vector similarity.
"""
import logging
from typing import Any, Dict, List, Optional
import numpy as np

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Service for generating text embeddings and performing semantic search.
    
    This is a mock implementation that would typically integrate with
    services like OpenAI, Cohere, or a custom embedding model.
    """
    
    def __init__(self):
        """Initialize the embedding service."""
        self.dimension = 384  # Common embedding dimension
        logger.info("Embedding service initialized")
    
    async def embed_text(self, text: str) -> List[float]:
        """
        Generate an embedding vector for the given text.
        
        Args:
            text: Input text to embed
            
        Returns:
            List of floats representing the embedding vector
            
        Raises:
            ValueError: If text is empty or invalid
        """
        if not text or not isinstance(text, str):
            raise ValueError("Text must be a non-empty string")
        
        try:
            # Mock implementation: generate a simple embedding based on text characteristics
            # In production, this would call an actual embedding model API
            np.random.seed(hash(text) % (2**32))  # Deterministic for same input
            embedding = np.random.randn(self.dimension).tolist()
            
            logger.debug(f"Generated embedding for text of length {len(text)}")
            return embedding
        except Exception as e:
            logger.error(f"Error generating embedding: {e}", exc_info=True)
            raise
    
    async def search_similar_jobs(
        self, 
        query_embedding: List[float], 
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search for jobs similar to the query embedding.
        
        Args:
            query_embedding: Embedding vector to search for
            top_k: Number of top results to return
            
        Returns:
            List of job dictionaries with similarity scores
            
        Raises:
            ValueError: If query_embedding is invalid
        """
        if not query_embedding or not isinstance(query_embedding, list):
            raise ValueError("query_embedding must be a non-empty list")
        
        if top_k <= 0:
            raise ValueError("top_k must be positive")
        
        try:
            # Mock implementation: return sample jobs with similarity scores
            # In production, this would query a vector database like Qdrant, Pinecone, etc.
            mock_jobs = [
                {
                    "id": "job_001",
                    "title": "Senior Python Developer",
                    "company": "Tech Corp",
                    "location": "Remote",
                    "description": "Looking for experienced Python developer with ML expertise",
                    "requirements": ["Python", "Machine Learning", "FastAPI", "Docker"],
                    "salary_range": {
                        "min_salary": 120000,
                        "max_salary": 180000,
                        "currency": "USD",
                        "period": "annual"
                    },
                    "job_type": "Full-time",
                    "remote": True,
                    "posted_date": "2025-12-20",
                    "apply_url": "https://example.com/apply/job_001",
                    "source": "company_website",
                    "similarity_score": 0.92
                },
                {
                    "id": "job_002",
                    "title": "Machine Learning Engineer",
                    "company": "AI Innovations",
                    "location": "San Francisco, CA",
                    "description": "Build and deploy ML models for production systems",
                    "requirements": ["Python", "TensorFlow", "PyTorch", "Kubernetes"],
                    "salary_range": {
                        "min_salary": 140000,
                        "max_salary": 200000,
                        "currency": "USD",
                        "period": "annual"
                    },
                    "job_type": "Full-time",
                    "remote": False,
                    "posted_date": "2025-12-22",
                    "apply_url": "https://example.com/apply/job_002",
                    "source": "job_board",
                    "similarity_score": 0.88
                },
                {
                    "id": "job_003",
                    "title": "Full Stack Developer with ML Focus",
                    "company": "DataTech Solutions",
                    "location": "Remote",
                    "description": "Develop full-stack applications with ML integration",
                    "requirements": ["Python", "React", "Machine Learning", "PostgreSQL"],
                    "salary_range": {
                        "min_salary": 110000,
                        "max_salary": 160000,
                        "currency": "USD",
                        "period": "annual"
                    },
                    "job_type": "Full-time",
                    "remote": True,
                    "posted_date": "2025-12-23",
                    "apply_url": "https://example.com/apply/job_003",
                    "source": "company_website",
                    "similarity_score": 0.85
                }
            ]
            
            # Sort by similarity score and limit to top_k
            results = sorted(
                mock_jobs, 
                key=lambda x: x.get("similarity_score", 0), 
                reverse=True
            )[:top_k]
            
            logger.info(f"Found {len(results)} similar jobs")
            return results
        
        except Exception as e:
            logger.error(f"Error searching for similar jobs: {e}", exc_info=True)
            raise


# Singleton instance
_embedding_service_instance: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """
    Get the singleton embedding service instance.
    
    Returns:
        EmbeddingService instance
    """
    global _embedding_service_instance
    if _embedding_service_instance is None:
        _embedding_service_instance = EmbeddingService()
    return _embedding_service_instance
