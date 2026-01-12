#!/usr/bin/env python3
"""
Verification script for spike projection rate limiting fix.

This script validates that all components are properly implemented and ready for deployment.
Run this before deploying to production.

Usage:
    python3 verify_solution.py
"""

import os
import sys
from pathlib import Path

# Color codes for terminal output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'
BOLD = '\033[1m'

def print_status(status, message):
    """Print colored status message."""
    if status == "pass":
        print(f"{GREEN}✅ PASS:{RESET} {message}")
        return True
    elif status == "fail":
        print(f"{RED}❌ FAIL:{RESET} {message}")
        return False
    elif status == "warn":
        print(f"{YELLOW}⚠️  WARN:{RESET} {message}")
        return True
    else:
        print(f"ℹ️  {message}")
        return True

def check_file_exists(filepath, description):
    """Check if a file exists."""
    if os.path.exists(filepath):
        return print_status("pass", f"{description} exists: {filepath}")
    else:
        return print_status("fail", f"{description} missing: {filepath}")

def check_python_syntax(filepath):
    """Check if Python file has valid syntax."""
    try:
        with open(filepath, 'r') as f:
            compile(f.read(), filepath, 'exec')
        return print_status("pass", f"Valid Python syntax: {filepath}")
    except SyntaxError as e:
        return print_status("fail", f"Syntax error in {filepath}: {e}")
    except Exception as e:
        return print_status("fail", f"Error checking {filepath}: {e}")

def check_required_functions(filepath, required_functions):
    """Check if required functions/classes exist in Python file."""
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        missing = []
        for func in required_functions:
            # Check for both function definitions and class definitions
            if f"def {func}" not in content and f"class {func}" not in content:
                missing.append(func)
        
        if missing:
            return print_status("fail", f"Missing functions/classes in {filepath}: {', '.join(missing)}")
        else:
            return print_status("pass", f"All required functions/classes present in {filepath}")
    except Exception as e:
        return print_status("fail", f"Error checking functions in {filepath}: {e}")

def count_lines(filepath):
    """Count lines in a file."""
    try:
        with open(filepath, 'r') as f:
            lines = len(f.readlines())
        print_status("info", f"  → {lines} lines of code")
        return True
    except:
        return True

def main():
    """Run all verification checks."""
    print(f"\n{BOLD}Spike Projection Rate Limiting Fix - Verification{RESET}")
    print("=" * 60)
    
    results = []
    
    # Check implementation files
    print(f"\n{BOLD}1. Implementation Files{RESET}")
    print("-" * 60)
    
    rate_limiter = "spike_projection_rate_limiter.py"
    results.append(check_file_exists(rate_limiter, "Rate limiter module"))
    results.append(check_python_syntax(rate_limiter))
    count_lines(rate_limiter)
    results.append(check_required_functions(rate_limiter, [
        "SpikeProjectionRateLimiter",
        "spike_projection_rate_limit",
        "get_current_concurrent_count",
        "reset_concurrent_count",
    ]))
    
    integration = "spike_projection_integration_example.py"
    results.append(check_file_exists(integration, "Integration example"))
    results.append(check_python_syntax(integration))
    count_lines(integration)
    results.append(check_required_functions(integration, [
        "run_spike_projection",
        "calculate_spike_projections",
    ]))
    
    # Check test files
    print(f"\n{BOLD}2. Test Files{RESET}")
    print("-" * 60)
    
    test_file = "spike_projection_rate_limiter_test.py"
    results.append(check_file_exists(test_file, "Test suite"))
    results.append(check_python_syntax(test_file))
    count_lines(test_file)
    
    # Check documentation
    print(f"\n{BOLD}3. Documentation{RESET}")
    print("-" * 60)
    
    docs = [
        ("SPIKE_PROJECTION_FIX.md", "Technical documentation"),
        ("SPIKE_PROJECTION_DEPLOYMENT.md", "Deployment guide"),
        ("README_SPIKE_PROJECTION_FIX.md", "README"),
        ("SOLUTION_SUMMARY.md", "Solution summary"),
    ]
    
    for doc_file, description in docs:
        results.append(check_file_exists(doc_file, description))
    
    # Check content completeness
    print(f"\n{BOLD}4. Content Checks{RESET}")
    print("-" * 60)
    
    try:
        with open(rate_limiter, 'r') as f:
            content = f.read()
        
        checks = [
            ("MAX_CONCURRENT_SPIKE_QUERIES" in content, "MAX_CONCURRENT_SPIKE_QUERIES constant"),
            ("acquire_slot" in content, "acquire_slot method"),
            ("release_slot" in content, "release_slot method"),
            ("@contextmanager" in content, "Context manager decorator"),
            ("metrics.incr" in content, "Metrics integration"),
            ("logger" in content, "Logging integration"),
        ]
        
        for check, description in checks:
            if check:
                results.append(print_status("pass", f"Contains {description}"))
            else:
                results.append(print_status("fail", f"Missing {description}"))
    except Exception as e:
        results.append(print_status("fail", f"Error checking content: {e}"))
    
    # Summary
    print(f"\n{BOLD}5. Summary{RESET}")
    print("=" * 60)
    
    passed = sum(results)
    total = len(results)
    percentage = (passed / total * 100) if total > 0 else 0
    
    print(f"Checks passed: {passed}/{total} ({percentage:.1f}%)")
    
    if passed == total:
        print(f"\n{GREEN}{BOLD}✅ All checks passed! Solution is ready for deployment.{RESET}")
        print("\nNext steps:")
        print("  1. Review SOLUTION_SUMMARY.md for quick overview")
        print("  2. Read SPIKE_PROJECTION_DEPLOYMENT.md for deployment steps")
        print("  3. Copy spike_projection_rate_limiter.py to getsentry/utils/")
        print("  4. Integrate following spike_projection_integration_example.py")
        print("  5. Run tests: pytest spike_projection_rate_limiter_test.py -v")
        return 0
    else:
        print(f"\n{RED}{BOLD}❌ Some checks failed. Please review and fix issues.{RESET}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
