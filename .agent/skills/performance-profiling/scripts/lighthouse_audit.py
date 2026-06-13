#!/usr/bin/env python3
"""
Skill: performance-profiling
Script: lighthouse_audit.py
Purpose: Run Lighthouse performance audit on a URL
Usage: python lighthouse_audit.py [https://example.com]
Output: JSON with performance scores
Note: Requires lighthouse CLI (npm install -g lighthouse)
"""
import subprocess
import json
import sys
import os
import tempfile

def load_config(project_path=".") -> dict:
    """Cascadingly load configuration for performance-profiling."""
    config_paths = [
        os.path.join(project_path, ".agent", "skills", "performance-profiling", "config.json"),
        os.path.join(project_path, "skills", "performance-profiling", "config.json"),
        os.path.join(os.getcwd(), ".agent", "skills", "performance-profiling", "config.json"),
        os.path.join(os.getcwd(), "skills", "performance-profiling", "config.json"),
    ]
    
    for path in config_paths:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                sys.stderr.write(f"Warning: Failed to load config from {path}: {e}\n")
    return {}

def run_lighthouse(url: str, config: dict = None) -> dict:
    """Run Lighthouse audit on URL."""
    if config is None:
        config = {}
        
    chrome_flags = config.get("chrome_flags", ["--headless"])
    categories = config.get("categories", ["performance", "accessibility", "best-practices", "seo"])
    timeout = config.get("timeout_seconds", 120)
    
    if isinstance(chrome_flags, list):
        chrome_flags_str = " ".join(chrome_flags)
    else:
        chrome_flags_str = str(chrome_flags)
        
    # Map any underscore best_practices to best-practices for Lighthouse CLI
    categories_cli = ["best-practices" if cat == "best_practices" else cat for cat in categories]
    categories_str = ",".join(categories_cli)
    
    try:
        with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as f:
            output_path = f.name
        
        cmd = [
            "lighthouse",
            url,
            "--output=json",
            f"--output-path={output_path}",
            f"--chrome-flags={chrome_flags_str}",
            f"--only-categories={categories_str}"
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        
        if os.path.exists(output_path):
            with open(output_path, 'r') as f:
                report = json.load(f)
            os.unlink(output_path)
            
            categories_data = report.get("categories", {})
            
            def get_score(cat_name):
                cat = categories_data.get(cat_name, {})
                score = cat.get("score")
                return int(score * 100) if score is not None else 0
                
            scores = {}
            for cat in categories:
                report_key = "best-practices" if cat in ("best_practices", "best-practices") else cat
                scores[cat] = get_score(report_key)
                
            return {
                "url": url,
                "scores": scores,
                "summary": get_summary(scores)
            }
        else:
            return {"error": "Lighthouse failed to generate report", "stderr": result.stderr[:500]}
            
    except subprocess.TimeoutExpired:
        return {"error": "Lighthouse audit timed out"}
    except FileNotFoundError:
        return {"error": "Lighthouse CLI not found. Install with: npm install -g lighthouse"}

def get_summary(scores: dict) -> str:
    """Generate summary based on scores."""
    perf = scores.get("performance", 0)
    if perf >= 90:
        return "[OK] Excellent performance"
    elif perf >= 50:
        return "[!] Needs improvement"
    else:
        return "[X] Poor performance"

if __name__ == "__main__":
    project_path = "."
    url = None
    
    if len(sys.argv) > 1:
        arg1 = sys.argv[1]
        if arg1.startswith("http://") or arg1.startswith("https://"):
            url = arg1
        else:
            project_path = arg1
            if len(sys.argv) > 2:
                url = sys.argv[2]
                
    config = load_config(project_path)
    if not url:
        url = config.get("url")
    
    if not url:
        print(json.dumps({"error": "Usage: python lighthouse_audit.py [project_path] <url> (or configure 'url' in config.json)"}))
        sys.exit(1)
        
    result = run_lighthouse(url, config)
    print(json.dumps(result, indent=2))

