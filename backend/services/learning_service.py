import os
import json
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import List, Dict, Any
from dotenv import load_dotenv
import openai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
client = None

def call_grok_fallback(prompt: str, json_format: bool = True) -> str:
    grok_api_key = os.getenv("GROK_API_KEY")
    if not grok_api_key:
        raise Exception("GROK_API_KEY not found")
        
    grok_client = openai.OpenAI(
        api_key=grok_api_key,
        base_url="https://api.x.ai/v1"
    )
    
    messages = []
    if json_format:
        messages.append({"role": "system", "content": "You are a helpful assistant. Return ONLY valid JSON."})
    messages.append({"role": "user", "content": prompt})
        
    response = grok_client.chat.completions.create(
        model="grok-2-latest",
        messages=messages,
        response_format={"type": "json_object"} if json_format else None
    )
    return response.choices[0].message.content

if api_key:
    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        print(f"[!] Failed to initialize Gemini Client: {str(e)}")

# ─────────────────────────────────────────────────────────────────────────────
# 1. MULTIPLE CHOICE QUIZ (BACKWARD COMPATIBILITY)
# ─────────────────────────────────────────────────────────────────────────────

class Question(BaseModel):
    id: int
    question: str
    options: List[str]
    correct_option_index: int  # 0-indexed (0 to 3)
    explanation: str

class QuizSchema(BaseModel):
    course_title: str
    difficulty: str
    questions: List[Question]

def generate_ai_quiz(course_title: str, difficulty: str) -> Dict[str, Any]:
    if not client:
        return get_fallback_quiz(course_title, difficulty)
        
    prompt = f"""
    Generate an interactive reasoning and knowledge quiz for the topic '{course_title}' at '{difficulty}' level.
    The quiz must consist of exactly 5 multiple choice questions.
    Each question must have exactly 4 logical options.
    Provide a clear, detailed explanation for the correct answer.
    Make sure the difficulty is appropriate (Beginner = basic terms, Intermediate = logic/coding, Expert = architecture/deep debugging).
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=QuizSchema,
                temperature=0.7
            )
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"[!] Gemini generation error: {str(e)}. Attempting Grok fallback.")
        try:
            grok_response = call_grok_fallback(prompt)
            return json.loads(grok_response)
        except Exception as grok_e:
            print(f"[!] Grok fallback error: {str(grok_e)}. Using local fallback quiz.")
            return get_fallback_quiz(course_title, difficulty)

def get_fallback_quiz(course_title: str, difficulty: str) -> Dict[str, Any]:
    title_lower = course_title.lower()
    if "python" in title_lower:
        return {
            "course_title": course_title,
            "difficulty": difficulty,
            "questions": [
                {"id": 1, "question": "What is the output of print(2 ** 3) in Python?", "options": ["6", "8", "9", "5"], "correct_option_index": 1, "explanation": "The double asterisk (**) operator represents exponentiation in Python. 2 raised to the power of 3 is 8."},
                {"id": 2, "question": "Which of the following data structures in Python is immutable?", "options": ["List", "Dictionary", "Tuple", "Set"], "correct_option_index": 2, "explanation": "Tuples are immutable sequences, meaning their elements cannot be changed after creation."},
                {"id": 3, "question": "How do you define a function in Python?", "options": ["func my_function():", "def my_function():", "function my_function():", "define my_function():"], "correct_option_index": 1, "explanation": "The 'def' keyword is used to declare functions in Python."},
                {"id": 4, "question": "What does the list method .append() do?", "options": ["Removes the last item", "Sorts the list", "Adds an item to the end of the list", "Reverses the list"], "correct_option_index": 2, "explanation": ".append() adds a single element to the end of an existing list."},
                {"id": 5, "question": "What is the output of len('Python')?", "options": ["5", "6", "7", "8"], "correct_option_index": 1, "explanation": "The len() function returns the number of characters in a string. 'Python' has 6 characters."}
            ]
        }
    elif "next.js" in title_lower or "react" in title_lower:
        return {
            "course_title": course_title,
            "difficulty": difficulty,
            "questions": [
                {"id": 1, "question": "Which folder is the root for routes in Next.js 13+ App Router?", "options": ["pages", "src/app", "src/routes", "public"], "correct_option_index": 1, "explanation": "Next.js App Router uses the 'app' directory (or 'src/app') for file-system based routing."},
                {"id": 2, "question": "What directive is used to mark a file as a React Client Component in Next.js?", "options": ['"client side"', '"use client"', '"client only"', '"react client"'], "correct_option_index": 1, "explanation": "The 'use client' directive at the top of a file tells Next.js to treat it as a Client Component."},
                {"id": 3, "question": "By default, components in Next.js App Router are...", "options": ["Client Components", "Server Components", "Static Pages", "Pure Javascript"], "correct_option_index": 1, "explanation": "By default, all components inside the app directory are React Server Components."},
                {"id": 4, "question": "Which of these is NOT a Next.js optimization component?", "options": ["<Image />", "<Link />", "<Script />", "<Router />"], "correct_option_index": 3, "explanation": "Next.js provides next/image, next/link, and next/script, but doesn't have a special <Router /> tag for UI."},
                {"id": 5, "question": "What is Next.js built on top of?", "options": ["Vue", "Angular", "React", "Svelte"], "correct_option_index": 2, "explanation": "Next.js is a React framework for building server-side rendered and static web applications."}
            ]
        }
    else:
        return {
            "course_title": course_title,
            "difficulty": difficulty,
            "questions": [
                {"id": 1, "question": "What is the primary role of a Load Balancer?", "options": ["To encrypt all network traffic", "To distribute incoming network traffic across multiple servers", "To backup database files", "To compile codebase"], "correct_option_index": 1, "explanation": "Load Balancers distribute traffic across a pool of servers to prevent overload and improve availability."},
                {"id": 2, "question": "Which caching strategy writes data to both cache and database simultaneously?", "options": ["Write-Through", "Write-Back", "Cache-Aside", "Read-Through"], "correct_option_index": 0, "explanation": "Write-Through updates both the cache and the backing store in a single transaction."},
                {"id": 3, "question": "What is vertical scaling?", "options": ["Adding more servers", "Adding more RAM/CPU to an existing server", "Splitting databases into shards", "Linking servers globally"], "correct_option_index": 1, "explanation": "Vertical scaling means increasing the capacity (CPU, RAM, Disk) of a single node."},
                {"id": 4, "question": "Which database scaling technique divides a table row-wise across multiple servers?", "options": ["Replication", "Normalization", "Sharding", "Indexing"], "correct_option_index": 2, "explanation": "Sharding partitions data row-wise across multiple databases."},
                {"id": 5, "question": "What does a CDN stand for?", "options": ["Centralized Domain Name", "Content Delivery Network", "Client Data Node", "Computed Direct Network"], "correct_option_index": 1, "explanation": "CDN stands for Content Delivery Network, used for caching assets closer to users."}
            ]
        }


# ─────────────────────────────────────────────────────────────────────────────
# 2. CODING CHALLENGE VERIFICATION (NEW FEATURE)
# ─────────────────────────────────────────────────────────────────────────────

class TestTarget(BaseModel):
    input: str
    expected: str

class CodingChallengeSchema(BaseModel):
    title: str
    description: str
    difficulty: str
    language: str
    boilerplate_code: str
    test_cases: List[TestTarget]
    optimal_solution_explanation: str

class SingleQuestionSchema(BaseModel):
    title: str
    description: str
    boilerplate_code: str
    test_cases: List[TestTarget]
    optimal_solution_explanation: str

class MultiQuestionExamSchema(BaseModel):
    title: str
    difficulty: str
    language: str
    questions: List[SingleQuestionSchema]

class TestCaseResult(BaseModel):
    input: str
    expected: str
    actual: str
    passed: bool

class CodeEvaluationSchema(BaseModel):
    score: int  # 0 to 100
    passed: bool
    feedback: str
    test_cases_run: List[TestCaseResult]

import re

def _sanitize_boilerplate(result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Safety net: If Gemini ignores our prompt and puts solution logic 
    inside boilerplate_code, strip it out and leave only empty function stubs.
    Handles both single challenges and multi-question exams.
    """
    if "questions" in result and isinstance(result["questions"], list):
        for idx, q in enumerate(result["questions"]):
            temp_res = {
                "boilerplate_code": q.get("boilerplate_code", ""),
                "language": result.get("language", "python")
            }
            sanitized = _sanitize_single_boilerplate(temp_res)
            result["questions"][idx]["boilerplate_code"] = sanitized.get("boilerplate_code", "")
        return result
    else:
        return _sanitize_single_boilerplate(result)

def _sanitize_single_boilerplate(result: Dict[str, Any]) -> Dict[str, Any]:
    boilerplate = result.get("boilerplate_code", "")
    language = result.get("language", "python")
    
    if not boilerplate:
        return result
    
    lines = boilerplate.split('\n')
    sanitized_lines = []
    inside_function = False
    indent_level = 0
    
    if language == "python":
        for line in lines:
            stripped = line.strip()
            # Keep function definitions, class definitions, imports, and comments at top level
            if stripped.startswith('def ') or stripped.startswith('class '):
                inside_function = True
                indent_level = len(line) - len(line.lstrip())
                sanitized_lines.append(line)
                # Add placeholder body
                body_indent = ' ' * (indent_level + 4)
                sanitized_lines.append(f"{body_indent}# Write your solution here")
                sanitized_lines.append(f"{body_indent}pass")
            elif not inside_function:
                # Keep top-level comments and blank lines
                if stripped == '' or stripped.startswith('#') or stripped.startswith('import ') or stripped.startswith('from '):
                    sanitized_lines.append(line)
            elif inside_function and stripped == '':
                # Blank line could signal end of function
                inside_function = False
                sanitized_lines.append(line)
            # Skip everything else inside function bodies (this is the solution code)
    else:
        # JavaScript
        for line in lines:
            stripped = line.strip()
            if stripped.startswith('function ') or re.match(r'^(const|let|var)\s+\w+\s*=\s*(function|\()', stripped):
                inside_function = True
                sanitized_lines.append(line)
                sanitized_lines.append('    // Write your solution here')
                sanitized_lines.append('    return null;')
            elif stripped == '}' and inside_function:
                inside_function = False
                sanitized_lines.append(line)
            elif not inside_function:
                sanitized_lines.append(line)
            # Skip everything else inside function bodies
    
    result["boilerplate_code"] = '\n'.join(sanitized_lines)
    return result

def generate_ai_coding_challenge(course_title: str, difficulty: str) -> Dict[str, Any]:
    """
    Generates a coding challenge for the given course topic
    and difficulty using the Gemini API.
    """
    if not client:
        return get_fallback_coding_challenge(course_title, difficulty)
        
    prompt = f"""
    Generate a coding challenge tailored for the topic '{course_title}' at '{difficulty}' difficulty.
    The challenge must be at Leetcode-level rigor appropriate for the difficulty.
    
    The response must match the CodingChallengeSchema structure:
    - title: A short, descriptive title for the problem.
    - description: A detailed problem description with parameters, return values, examples, and constraints.
    - difficulty: "{difficulty}"
    - language: Either 'python' or 'javascript' (match the course topic).
    - boilerplate_code: ONLY the empty function stub(s) for the student to fill in.
    - test_cases: A list of 3-4 input-output test cases for evaluation.
    - optimal_solution_explanation: Explain the logic and approach of the optimal solution (this is hidden from students).
    
    CRITICAL RULES FOR boilerplate_code:
    - The boilerplate_code MUST contain ONLY empty function signatures with placeholder bodies.
    - For Python: use 'pass' or 'return None' as the body. Example: 'def solve(nums: list) -> int:\n    # Write your solution here\n    pass'
    - For JavaScript: use 'return null;' as the body. Example: 'function solve(nums) {{\n    // Write your solution here\n    return null;\n}}'
    - NEVER include any solution logic, algorithms, or working code in boilerplate_code.
    - NEVER include comments that hint at the solution approach in boilerplate_code.
    - The student must write the entire solution themselves from scratch.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=CodingChallengeSchema,
                temperature=0.7
            )
        )
        result = json.loads(response.text)
        result = _sanitize_boilerplate(result)
        return result
    except Exception as e:
        print(f"[!] Gemini coding challenge generation error: {str(e)}. Attempting Grok fallback.")
        try:
            grok_response = call_grok_fallback(prompt)
            result = json.loads(grok_response)
            result = _sanitize_boilerplate(result)
            return result
        except Exception as grok_e:
            print(f"[!] Grok fallback error: {str(grok_e)}. Using local fallback challenge.")
            return get_fallback_coding_challenge(course_title, difficulty)

def generate_exam_for_lesson_ai(course_title: str, lesson_title: str, lesson_content: str, topics: str, difficulty: str, num_questions: int = 1) -> Dict[str, Any]:
    """
    Generates a coding challenge tailored for a specific syllabus index/lesson.
    """
    if not client:
        return get_fallback_coding_challenge(course_title, difficulty)
        
    is_multi = num_questions > 1
    
    if is_multi:
        prompt = f"""
        Generate a coding exam for the course '{course_title}', lesson '{lesson_title}'.
        Lesson content summary: {lesson_content[:500]}
        Topics to cover: {topics}
        
        Difficulty: '{difficulty}' — use Leetcode-level rigor matching this difficulty.
        Number of tasks: exactly {num_questions}.
        
        You MUST generate exactly {num_questions} separate coding questions as a list.
        
        CRITICAL RULES FOR boilerplate_code of each question:
        - The boilerplate_code MUST contain ONLY empty function signatures with placeholder bodies.
        - For Python: use 'pass' as the body. Example: 'def task_one(nums: list) -> int:\n    # Write your solution here\n    pass'
        - For JavaScript: use 'return null;' as the body.
        - ABSOLUTELY DO NOT include any solution logic, algorithms, loops, conditionals, or working code.
        - ABSOLUTELY DO NOT include comments that hint at the solution approach.
        - The student must write the entire solution themselves.
        
        Language: Either 'python' or 'javascript' (suitable for the course topic).
        """
        schema = MultiQuestionExamSchema
    else:
        prompt = f"""
        Generate a coding exam for the course '{course_title}', lesson '{lesson_title}'.
        Lesson content summary: {lesson_content[:500]}
        Topics to cover: {topics}
        
        Difficulty: '{difficulty}' — use Leetcode-level rigor matching this difficulty.
        Number of tasks: exactly 1.
        
        CRITICAL RULES FOR boilerplate_code:
        - The boilerplate_code MUST contain ONLY empty function signatures with placeholder bodies.
        - For Python: use 'pass' as the body. Example: 'def task_one(nums: list) -> int:\n    # Write your solution here\n    pass'
        - For JavaScript: use 'return null;' as the body.
        - ABSOLUTELY DO NOT include any solution logic, algorithms, loops, conditionals, or working code.
        - ABSOLUTELY DO NOT include comments that hint at the solution approach.
        - The student must write the entire solution themselves.
        
        Language: Either 'python' or 'javascript' (suitable for the course topic).
        """
        schema = CodingChallengeSchema
        
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema,
                temperature=0.7
            )
        )
        result = json.loads(response.text)
        result = _sanitize_boilerplate(result)
        return result
    except Exception as e:
        print(f"[!] Gemini exam generation error: {str(e)}. Attempting Grok fallback.")
        try:
            grok_response = call_grok_fallback(prompt)
            result = json.loads(grok_response)
            result = _sanitize_boilerplate(result)
            return result
        except Exception as grok_e:
            print(f"[!] Grok fallback error: {str(grok_e)}. Using fallback challenge.")
            return get_fallback_coding_challenge(course_title, difficulty)

def generate_final_exam_ai(course_title: str, difficulty: str, topics: str, num_questions: int = 1) -> Dict[str, Any]:
    """
    Generates a comprehensive final coding challenge for the course.
    """
    if not client:
        return get_fallback_coding_challenge(course_title, difficulty)
        
    is_multi = num_questions > 1
    
    if is_multi:
        prompt = f"""
        Generate a comprehensive final exam for the course '{course_title}'.
        Topics to cover: {topics}
        
        Difficulty: '{difficulty}' — use Leetcode-level rigor matching this difficulty.
        Number of tasks: exactly {num_questions}.
        
        You MUST generate exactly {num_questions} separate coding questions as a list.
        
        CRITICAL RULES FOR boilerplate_code of each question:
        - The boilerplate_code MUST contain ONLY empty function signatures with placeholder bodies.
        - For Python: use 'pass' as the body. Example: 'def task_one(nums: list) -> int:\n    # Write your solution here\n    pass'
        - For JavaScript: use 'return null;' as the body.
        - ABSOLUTELY DO NOT include any solution logic, algorithms, loops, conditionals, or working code.
        - ABSOLUTELY DO NOT include comments that hint at the solution approach.
        - The student must write the entire solution themselves.
        
        Language: Either 'python' or 'javascript' (suitable for the course topic).
        """
        schema = MultiQuestionExamSchema
    else:
        prompt = f"""
        Generate a comprehensive final exam for the course '{course_title}'.
        Topics to cover: {topics}
        
        Difficulty: '{difficulty}' — use Leetcode-level rigor matching this difficulty.
        Number of tasks: exactly 1.
        
        CRITICAL RULES FOR boilerplate_code:
        - The boilerplate_code MUST contain ONLY empty function signatures with placeholder bodies.
        - For Python: use 'pass' as the body. Example: 'def task_one(nums: list) -> int:\n    # Write your solution here\n    pass'
        - For JavaScript: use 'return null;' as the body.
        - ABSOLUTELY DO NOT include any solution logic, algorithms, loops, conditionals, or working code.
        - ABSOLUTELY DO NOT include comments that hint at the solution approach.
        - The student must write the entire solution themselves.
        
        Language: Either 'python' or 'javascript' (suitable for the course topic).
        """
        schema = CodingChallengeSchema
        
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema,
                temperature=0.7
            )
        )
        result = json.loads(response.text)
        result = _sanitize_boilerplate(result)
        return result
    except Exception as e:
        print(f"[!] Gemini final exam generation error: {str(e)}. Attempting Grok fallback.")
        try:
            grok_response = call_grok_fallback(prompt)
            result = json.loads(grok_response)
            result = _sanitize_boilerplate(result)
            return result
        except Exception as grok_e:
            print(f"[!] Grok fallback error: {str(grok_e)}. Using fallback challenge.")
            return get_fallback_coding_challenge(course_title, difficulty)

def evaluate_ai_coding_challenge(challenge_title: str, description: str, language: str, test_cases: List[Dict[str, Any]], student_code: str, boilerplate_code: str = "") -> Dict[str, Any]:
    """
    Evaluates the student's submitted code against the problem statement
    and test cases using Gemini API.
    """
    # Pre-check: if student submitted unchanged boilerplate or empty code, auto-fail
    stripped_student = student_code.strip()
    stripped_boilerplate = boilerplate_code.strip() if boilerplate_code else ""
    
    if not stripped_student or stripped_student == stripped_boilerplate:
        return {
            "score": 0,
            "passed": False,
            "feedback": "The submitted code is identical to the boilerplate starter code or is empty. No solution was implemented. You must write your own solution to pass the exam.",
            "test_cases_run": [{"input": tc.get("input", ""), "expected": tc.get("expected", ""), "actual": "No output (code unchanged)", "passed": False} for tc in test_cases]
        }
    
    # Check for placeholder-only submissions (just 'pass', 'return None', 'return null' etc.)
    code_lines = [line.strip() for line in stripped_student.split('\n') if line.strip() and not line.strip().startswith('#') and not line.strip().startswith('//')]
    meaningful_lines = [line for line in code_lines if line not in ('pass', 'return None', 'return null;', 'return null', 'return;', '')]
    # Filter out lines that are only function definitions
    non_def_lines = [line for line in meaningful_lines if not line.startswith('def ') and not line.startswith('function ')]
    
    if len(non_def_lines) == 0:
        return {
            "score": 0,
            "passed": False,
            "feedback": "The submitted code contains no actual implementation. Only placeholder/stub code was detected (e.g., 'pass', 'return None'). You must implement a working solution.",
            "test_cases_run": [{"input": tc.get("input", ""), "expected": tc.get("expected", ""), "actual": "No implementation found", "passed": False} for tc in test_cases]
        }
    
    if not client:
        return evaluate_fallback_coding_challenge(challenge_title, student_code, boilerplate_code)
        
    prompt = f"""
    You are a strict code examiner. Evaluate the student's code submission for: '{challenge_title}'.
    
    Problem Description:
    {description}
    
    Programming Language: {language}
    
    Test Cases:
    {json.dumps(test_cases, indent=2)}
    
    Original Boilerplate (starter code given to student):
    ```
    {boilerplate_code}
    ```
    
    Student's Submitted Code:
    ```
    {student_code}
    ```
    
    STRICT EVALUATION RULES:
    1. If the student's code is identical or nearly identical to the boilerplate, score MUST be 0.
    2. If the code only contains placeholder statements (pass, return None, return null), score MUST be 0.
    3. Actually simulate running each test case mentally. Report the real actual output.
    4. If the code has syntax errors, score MUST be below 30.
    5. Only give score >= 80 if the code ACTUALLY solves the problem correctly for ALL test cases.
    
    Analyze:
    1. Correctness: Simulate execution against each test case. Report actual vs expected output.
    2. Edge cases: Does it handle boundary inputs?
    3. Complexity: Time and space complexity analysis.
    4. Code quality: Variable names, style, cleanliness.
    
    Return JSON with:
    - score: 0-100 (BE STRICT — only 80+ if all test cases pass)
    - passed: Boolean (True ONLY if score >= 80)
    - feedback: Detailed review with simulated execution logs per test case
    - test_cases_run: List with input, expected, actual (from simulation), passed (boolean)
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=CodeEvaluationSchema,
                temperature=0.2
            )
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"[!] Gemini code evaluation error: {str(e)}. Attempting Grok fallback.")
        try:
            grok_response = call_grok_fallback(prompt)
            return json.loads(grok_response)
        except Exception as grok_e:
            print(f"[!] Grok fallback error: {str(grok_e)}. Using local fallback evaluation.")
            return evaluate_fallback_coding_challenge(challenge_title, student_code, boilerplate_code)

def get_fallback_coding_challenge(course_title: str, difficulty: str) -> Dict[str, Any]:
    title_lower = course_title.lower()
    if "python" in title_lower:
        return {
            "title": "Reverse Words in a String",
            "description": "Write a function `reverse_words(s: str) -> str` that reverses the order of words in a given string. A word is defined as a sequence of non-space characters. The words in the input string may be separated by multiple spaces, but the output string should only have a single space separating the words. Do not include leading or trailing spaces.\n\nExample 1:\nInput: 'the sky is blue'\nOutput: 'blue is sky the'\n\nExample 2:\nInput: '  hello world  '\nOutput: 'world hello'",
            "difficulty": difficulty,
            "language": "python",
            "boilerplate_code": "def reverse_words(s: str) -> str:\n    # Write your code here\n    pass",
            "test_cases": [
                {"input": "\"the sky is blue\"", "expected": "\"blue is sky the\""},
                {"input": "\"  hello world  \"", "expected": "\"world hello\""},
                {"input": "\"a good   example\"", "expected": "\"example good a\""}
            ],
            "optimal_solution_explanation": "Split the string by spaces (which automatically handles multiple spaces in Python using s.split()), reverse the list of words, and join them back together with a single space."
        }
    elif "next.js" in title_lower or "react" in title_lower:
        return {
            "title": "Get Query Parameter Value",
            "description": "Write a function `getQueryParam(url: string, param: string): string | null` that parses a URL string and extracts the value of a specific query parameter. If the parameter is not present or has no value, return null.\n\nExample 1:\nInput: url = 'https://example.com?page=2&sort=desc', param = 'page'\nOutput: '2'\n\nExample 2:\nInput: url = 'https://example.com', param = 'sort'\nOutput: null",
            "difficulty": difficulty,
            "language": "javascript",
            "boilerplate_code": "function getQueryParam(url, param) {\n    // Write your JS/TS code here\n    return null;\n}",
            "test_cases": [
                {"input": "\"https://example.com?page=2&sort=desc\", \"page\"", "expected": "\"2\""},
                {"input": "\"https://example.com?page=2&sort=desc\", \"sort\"", "expected": "\"desc\""},
                {"input": "\"https://example.com\", \"sort\"", "expected": "null"}
            ],
            "optimal_solution_explanation": "Use the URL constructor or URLSearchParams in JavaScript to easily parse search params. E.g., `new URL(url).searchParams.get(param)`."
        }
    else:
        return {
            "title": "Design a Distributed Rate Limiter",
            "description": "Provide a high-level pseudo-code implementation of an `is_allowed(user_id: str, limit: int, window_secs: int) -> bool` function for a distributed Rate Limiter (sliding window log or token bucket). The solution should account for concurrency and specify how state is stored (e.g., using Redis commands in pseudo-code).\n\nInclude:\n1. State storage representation.\n2. Concurrency handling (e.g. locks or Lua script commands).\n3. Logic to check and update window count.\n\nWrite your answer as a commented Python/Javascript or structured pseudocode implementation.",
            "difficulty": difficulty,
            "language": "python",
            "boilerplate_code": "# Pseudocode / System Design Implementation\ndef is_allowed(user_id: str, limit: int, window_secs: int) -> bool:\n    # Outline state store, Redis keys, and atomic operations\n    pass",
            "test_cases": [
                {"input": "\"user_123\", 5, 60", "expected": "true / false"},
                {"input": "\"user_123\", 5, 60 (exceeded)", "expected": "false"}
            ],
            "optimal_solution_explanation": "Use a Redis sorted set (ZSET) representing timestamps of the requests. Clean up elements older than `now - window_secs`, count the cardinality, and insert the new timestamp if count is below limit."
        }

def evaluate_fallback_coding_challenge(challenge_title: str, student_code: str, boilerplate_code: str = "") -> Dict[str, Any]:
    """Fallback evaluator when AI APIs are unavailable. Uses basic heuristics but is STRICT."""
    stripped_student = student_code.strip()
    stripped_boilerplate = boilerplate_code.strip() if boilerplate_code else ""
    
    # Check 1: Empty or unchanged boilerplate
    if not stripped_student or stripped_student == stripped_boilerplate:
        return {
            "score": 0,
            "passed": False,
            "feedback": "Your submission is empty or identical to the starter code. You must implement a solution.",
            "test_cases_run": [
                {"input": "All test cases", "expected": "A working solution", "actual": "No code written", "passed": False}
            ]
        }
    
    # Check 2: Only placeholder statements
    code_lines = [line.strip() for line in stripped_student.split('\n') if line.strip() and not line.strip().startswith('#') and not line.strip().startswith('//')]
    meaningful_lines = [line for line in code_lines if line not in ('pass', 'return None', 'return null;', 'return null', 'return;', '')]
    non_def_lines = [line for line in meaningful_lines if not line.startswith('def ') and not line.startswith('function ')]
    
    if len(non_def_lines) == 0:
        return {
            "score": 0,
            "passed": False,
            "feedback": "Your code contains only placeholder statements (pass/return None). No actual implementation was detected.",
            "test_cases_run": [
                {"input": "All test cases", "expected": "A working solution", "actual": "Only placeholders found", "passed": False}
            ]
        }
    
    # Check 3: Very short code (less than 3 meaningful lines is suspicious)
    if len(non_def_lines) < 3:
        return {
            "score": 30,
            "passed": False,
            "feedback": f"Fallback Evaluator: Your submission for '{challenge_title}' contains very little code ({len(non_def_lines)} meaningful lines). The AI evaluation service is temporarily unavailable. Your submission has been recorded and will be reviewed by a mentor.",
            "test_cases_run": [
                {"input": "All test cases", "expected": "Complete solution", "actual": "Insufficient code", "passed": False}
            ]
        }
    
    # Check 4: Code has reasonable length — can't verify correctness without AI, 
    # so give a pending score and mark for mentor review
    return {
        "score": 50,
        "passed": False,
        "feedback": f"Fallback Evaluator: The AI grading service is temporarily unavailable. Your submission for '{challenge_title}' has been recorded with {len(non_def_lines)} lines of implementation code. It has been marked for manual review by your mentor. A mentor will evaluate your code and assign the final score.",
        "test_cases_run": [
            {"input": "All test cases", "expected": "Correct output", "actual": "Pending AI/mentor review", "passed": False}
        ]
    }

# ─────────────────────────────────────────────────────────────────────────────
# 3. AI LESSON EXPLANATION GENERATION
# ─────────────────────────────────────────────────────────────────────────────

class AILessonContentSchema(BaseModel):
    content: str
    practice_code: str
    language: str

def generate_lesson_explanation_ai(lesson_title: str, course_title: str, difficulty: str) -> Dict[str, Any]:
    if not client:
        return get_fallback_lesson_explanation(lesson_title, course_title, difficulty)
        
    prompt = f"""
    You are an expert technical content writer for GeeksforGeeks.
    Create a highly detailed, comprehensive written tutorial for the lesson module: "{lesson_title}"
    which belongs to the course: "{course_title}" (Difficulty Level: {difficulty}).

    Requirements:
    1. Structure the written explanation in clean, standard Markdown.
    2. Use Markdown headings (e.g., '### Heading', '## Heading') for sub-sections.
    3. Include bullet points, bold terms for vocabulary, and inline code blocks (using backticks) to explain the core concepts.
    4. Provide a complete, fully functional, and well-commented sample code snippet that the student can run and practice.
    5. Determine the correct programming language or configuration format for the code snippet (e.g. python, typescript, tsx, nginx, sql) based on the course:
       - If course is Next.js, use typescript or tsx.
       - If course is Python, use python.
       - If course is System Design, use nginx, redis (python), sql, or shell.
       - Otherwise, use python or javascript.
    
    Ensure the explanation is deep, premium, and extremely clear, with no placeholders.
    """

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AILessonContentSchema,
                temperature=0.7
            )
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"[!] Gemini lesson explanation generation failed: {str(e)}. Attempting Grok fallback.")
        try:
            grok_response = call_grok_fallback(prompt)
            return json.loads(grok_response)
        except Exception as grok_e:
            print(f"[!] Grok fallback error: {str(grok_e)}. Using local fallback.")
            return get_fallback_lesson_explanation(lesson_title, course_title, difficulty)

def get_fallback_lesson_explanation(lesson_title: str, course_title: str, difficulty: str) -> Dict[str, Any]:
    course_lower = course_title.lower()
    if "python" in course_lower:
        lang = "python"
        practice = f"""# Python Practice Code: {lesson_title}
def run_practice():
    print("Running task: {lesson_title}")
    data = [1, 2, 3, 4, 5]
    result = [x * 2 for x in data]
    print(f"Processed result: {{result}}")
    return True

run_practice()"""
    elif "next.js" in course_lower or "react" in course_lower:
        lang = "typescript"
        practice = f"""// TypeScript Practice Code: {lesson_title}
export async function runPractice() {{
  console.log("Running Next.js task: {lesson_title}");
  const items = ["page.tsx", "layout.tsx", "loading.tsx"];
  return {{
    status: "success",
    items: items
  }};
}}"""
    else:
        lang = "python"
        practice = f"""# System Design Practice Code: {lesson_title}
def simulate_architecture():
    print("Simulating architecture for: {lesson_title}")
    nodes = ["node_0", "node_1", "node_2"]
    for i, node in enumerate(nodes):
        print(f"Node {{i}}: {{node}} initialized")
    return True

simulate_architecture()"""

    content = f"""### {lesson_title} (AI-Generated Fallback)

Welcome to the lesson on **{lesson_title}** within the course **{course_title}**.

#### Key Concept Overview:
- This module covers core industry practices for **{lesson_title}** at a **{difficulty}** level.
- Learn how to structure and write high-quality, optimal code blocks.
- Follow the practice code example below to understand the runtime execution and syntax definitions.

#### Practice Objective:
Review the following code block, observe the syntax conventions of **{lang}**, and prepare for your coding verification quiz."""

    return {
        "content": content,
        "practice_code": practice,
        "language": lang
    }

def generate_ai_hint(challenge_title: str, description: str, language: str, student_code: str, chat_history: list, user_message: str) -> str:
    """
    Generates a conceptual hints chatbot response for the quiz challenge.
    Explicitly forbids writing full code solutions, complete functions, or key logic.
    """
    if not client:
        return "Think about the logic of the problem and verify your edge cases."

    history_str = ""
    for msg in chat_history:
        role = "Student" if msg.get("role") == "user" else "Assistant"
        content = msg.get("content", "")
        history_str += f"{role}: {content}\n"

    prompt = f"""
    You are an AI Hints Assistant for a timed proctored coding test challenge: '{challenge_title}'.
    
    Problem Statement:
    {description}
    
    Target Programming Language: {language}
    
    Student's Current Code in Editor:
    ```
    {student_code}
    ```
    
    Chat Conversation History:
    {history_str}
    
    Student's Latest Request:
    "{user_message}"
    
    YOUR CRITICAL INSTRUCTIONS:
    1. You are here to guide and teach, not to do the work.
    2. NEVER output complete code blocks, complete functions, full copy-pasteable solutions, or key logic implementations.
    3. You CAN output tiny pseudo-code lines or explain standard library functions (e.g. "You can use `split()` in Python").
    4. Focus on identifying logical bugs in the student's code, explaining the algorithmic concepts, or guiding them on edge cases.
    5. Keep your response encouraging, plain text, and brief.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3
            )
        )
        return response.text.strip()
    except Exception as e:
        print(f"[!] Gemini AI Hint generation error: {str(e)}. Attempting Grok fallback.")
        try:
            grok_response = call_grok_fallback(prompt, json_format=False)
            return grok_response.strip()
        except Exception as grok_e:
            print(f"[!] Grok fallback error: {str(grok_e)}. Using fallback hint.")
            return "Try breaking down the problem into smaller logical steps."
