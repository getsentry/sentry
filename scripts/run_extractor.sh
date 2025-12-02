#!/bin/bash
if [ -z "$1" ]; then
    echo "Usage: ./scripts/run_extractor.sh <input_csv>"
    exit 1
fi

OUTPUT_CSV="$HOME/Desktop/llm_evidence_$(date +%Y%m%d_%H%M%S).csv"
python3 scripts/extract_llm_issue_evidence.py "$1" "$OUTPUT_CSV"
