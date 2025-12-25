"""LinkedIn Optimizer Service for profile optimization."""

from typing import Optional, Dict, List, Any


class LinkedInOptimizerService:
    """Service class for LinkedIn profile optimization."""

    def __init__(self):
        """Initialize the LinkedIn Optimizer Service."""
        self._best_practices = self._load_best_practices()

    def _load_best_practices(self) -> Dict[str, Dict[str, Any]]:
        """Load best practices data for different LinkedIn sections."""
        return {
            "headline": {
                "title": "Headline Best Practices",
                "tips": [
                    "Keep it concise and impactful (under 120 characters)",
                    "Include your current role and value proposition",
                    "Use keywords relevant to your industry",
                    "Avoid generic job titles; be specific about what you do",
                    "Consider adding a unique personal brand statement"
                ],
                "examples": [
                    "Senior Software Engineer | Cloud Architecture | AWS & Azure Specialist",
                    "Marketing Director | Digital Strategy | Growing B2B SaaS Brands",
                    "Data Scientist | Machine Learning | Transforming Data into Business Insights"
                ],
                "common_mistakes": [
                    "Using only your job title without context",
                    "Including too much information",
                    "Not updating it regularly",
                    "Missing keywords for searchability"
                ]
            },
            "about": {
                "title": "About Section Best Practices",
                "tips": [
                    "Start with a strong opening that captures attention",
                    "Write in first person to create a personal connection",
                    "Highlight your unique value proposition",
                    "Include relevant accomplishments and metrics",
                    "Use short paragraphs for readability",
                    "End with a clear call-to-action",
                    "Keep it between 1,300-2,000 characters for optimal engagement"
                ],
                "structure": [
                    "Opening hook (1-2 sentences)",
                    "Your background and expertise (2-3 paragraphs)",
                    "Key achievements with metrics (bullet points or short paragraphs)",
                    "Your passion or unique approach (1 paragraph)",
                    "Call-to-action (how to reach you)"
                ],
                "common_mistakes": [
                    "Writing in third person",
                    "Being too vague or generic",
                    "Focusing only on past instead of present and future",
                    "Not including a call-to-action",
                    "Making it too long or too short"
                ]
            },
            "experience": {
                "title": "Experience Section Best Practices",
                "tips": [
                    "Use action verbs to start each bullet point",
                    "Include quantifiable achievements and metrics",
                    "Focus on impact and results, not just responsibilities",
                    "Tailor descriptions to your target audience",
                    "Keep descriptions concise but comprehensive",
                    "Include relevant keywords for your industry",
                    "Add rich media (presentations, projects, articles) where applicable"
                ],
                "action_verbs": [
                    "Led", "Developed", "Implemented", "Increased", "Reduced",
                    "Managed", "Created", "Improved", "Optimized", "Launched",
                    "Achieved", "Streamlined", "Coordinated", "Spearheaded", "Transformed"
                ],
                "formula": "Action Verb + Task + Result/Impact",
                "examples": [
                    "Led cross-functional team of 12 to deliver $2M project 3 weeks ahead of schedule",
                    "Developed marketing strategy that increased lead generation by 45% in Q1",
                    "Implemented automated testing framework, reducing bugs by 60% and saving 20 hours/week"
                ],
                "common_mistakes": [
                    "Listing only job duties without accomplishments",
                    "Not including metrics or quantifiable results",
                    "Using passive voice",
                    "Making descriptions too long or too generic"
                ]
            },
            "skills": {
                "title": "Skills Section Best Practices",
                "tips": [
                    "List your top 3 skills first (they appear prominently)",
                    "Include a mix of hard and soft skills",
                    "Add skills relevant to your current goals",
                    "Get endorsements from colleagues and connections",
                    "Take skill assessments to earn badges",
                    "Regularly update to reflect new competencies",
                    "Include industry-specific keywords for better searchability"
                ],
                "skill_types": {
                    "hard_skills": [
                        "Technical skills (programming languages, tools, platforms)",
                        "Industry-specific knowledge",
                        "Certifications and licenses"
                    ],
                    "soft_skills": [
                        "Leadership and management",
                        "Communication and collaboration",
                        "Problem-solving and critical thinking",
                        "Project management"
                    ]
                },
                "optimization": [
                    "Prioritize skills with high search volume in your industry",
                    "Align skills with your headline and about section",
                    "Request endorsements from credible connections",
                    "Remove outdated or irrelevant skills"
                ],
                "common_mistakes": [
                    "Adding too many skills (quality over quantity)",
                    "Including irrelevant or outdated skills",
                    "Not prioritizing your strongest skills",
                    "Forgetting to get endorsements"
                ]
            },
            "education": {
                "title": "Education Section Best Practices",
                "tips": [
                    "Include all relevant degrees and certifications",
                    "Add your GPA if it's above 3.5 (especially for recent graduates)",
                    "List relevant coursework, honors, and activities",
                    "Include any research, publications, or thesis work",
                    "Add study abroad or exchange programs",
                    "Keep descriptions concise but informative",
                    "Include continuing education and professional development"
                ],
                "what_to_include": [
                    "Degree name and field of study",
                    "University/institution name",
                    "Graduation date (or expected date)",
                    "Relevant honors, awards, or scholarships",
                    "Relevant coursework or specializations",
                    "Extracurricular activities and leadership roles",
                    "Academic projects or research"
                ],
                "for_recent_grads": [
                    "Highlight relevant coursework and projects",
                    "Include internships and co-op experiences",
                    "Mention academic achievements and awards",
                    "Add relevant student organizations and leadership",
                    "Include capstone projects or thesis work"
                ],
                "common_mistakes": [
                    "Omitting relevant certifications or continuing education",
                    "Not including enough detail for recent graduates",
                    "Including too much detail for experienced professionals",
                    "Forgetting to add online courses or bootcamps"
                ]
            }
        }

    async def get_best_practices(
        self, section: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get LinkedIn best practices and tips for profile optimization.

        Args:
            section: Optional section name to get specific best practices.
                     Valid values: "headline", "about", "experience", "skills", "education"
                     If None, returns best practices for all sections.

        Returns:
            Dictionary containing best practices data.

        Raises:
            ValueError: If an invalid section is provided.
        """
        valid_sections = {
            "headline", "about", "experience", "skills", "education"
        }

        if section is not None:
            section = section.lower()
            if section not in valid_sections:
                raise ValueError(
                    f"Invalid section '{section}'. "
                    f"Must be one of: {', '.join(sorted(valid_sections))}"
                )
            return {
                "section": section,
                "data": self._best_practices.get(section, {})
            }

        # Return all best practices
        return {
            "sections": list(valid_sections),
            "data": self._best_practices,
            "general_tips": [
                "Keep your profile complete (aim for 100% profile strength)",
                "Use a professional photo and background image",
                "Customize your LinkedIn URL",
                "Be active: share content, engage with posts, publish articles",
                "Request and write recommendations",
                "Join and participate in relevant groups",
                "Keep your profile updated regularly",
                "Use keywords throughout your profile for better searchability",
                "Ensure consistency across all sections",
                "Proofread for grammar and spelling errors"
            ]
        }

    async def generate_headline(
        self, current_role: str, industry: str, key_skills: List[str]
    ) -> Dict[str, Any]:
        """Generate optimized LinkedIn headline suggestions."""
        # Implementation for headline generation
        suggestions = [
            f"{current_role} | {' | '.join(key_skills[:3])}",
            f"{current_role} specializing in {' & '.join(key_skills[:2])}",
            f"{industry} Professional | {current_role} | {key_skills[0]} Expert"
        ]
        return {
            "suggestions": suggestions,
            "tips": self._best_practices["headline"]["tips"]
        }

    async def analyze_keywords(
        self, profile_text: str, target_role: str
    ) -> Dict[str, Any]:
        """Analyze keyword optimization in profile text."""
        # Basic keyword analysis implementation
        word_count = len(profile_text.split())
        return {
            "word_count": word_count,
            "target_role": target_role,
            "optimization_score": 75,  # Placeholder score
            "recommendations": [
                "Add more industry-specific keywords",
                "Include technical skills in your descriptions",
                "Use action verbs in experience section"
            ]
        }

    async def get_suggestions(
        self, profile_section: str, content: str
    ) -> Dict[str, Any]:
        """Get improvement suggestions for a profile section."""
        section_data = self._best_practices.get(profile_section.lower(), {})
        return {
            "section": profile_section,
            "suggestions": section_data.get("tips", []),
            "common_mistakes": section_data.get("common_mistakes", []),
            "content_length": len(content),
            "recommendations": [
                "Review the best practices for this section",
                "Add specific metrics and achievements",
                "Use keywords relevant to your industry"
            ]
        }

    async def get_action_words(self) -> Dict[str, List[str]]:
        """Get categorized action words for profile descriptions."""
        return {
            "leadership": [
                "Led", "Directed", "Managed", "Supervised", "Coordinated",
                "Orchestrated", "Spearheaded", "Guided", "Mentored"
            ],
            "achievement": [
                "Achieved", "Accomplished", "Delivered", "Exceeded", "Surpassed",
                "Earned", "Attained", "Reached", "Completed"
            ],
            "improvement": [
                "Improved", "Enhanced", "Optimized", "Streamlined", "Upgraded",
                "Modernized", "Refined", "Transformed", "Revamped"
            ],
            "creation": [
                "Created", "Developed", "Designed", "Built", "Established",
                "Launched", "Founded", "Pioneered", "Initiated", "Formulated"
            ],
            "growth": [
                "Increased", "Grew", "Expanded", "Scaled", "Boosted",
                "Amplified", "Accelerated", "Multiplied", "Strengthened"
            ],
            "efficiency": [
                "Reduced", "Decreased", "Minimized", "Eliminated", "Consolidated",
                "Automated", "Simplified", "Standardized", "Centralized"
            ],
            "collaboration": [
                "Collaborated", "Partnered", "Facilitated", "United", "Engaged",
                "Communicated", "Negotiated", "Consulted", "Liaised"
            ],
            "analysis": [
                "Analyzed", "Evaluated", "Assessed", "Researched", "Investigated",
                "Examined", "Diagnosed", "Audited", "Reviewed", "Studied"
            ]
        }
