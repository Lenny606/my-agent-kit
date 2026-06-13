#!/usr/bin/env python3
"""
Skill: webapp-testing
Script: playwright_runner.py
Purpose: Run basic Playwright browser tests
Usage: python playwright_runner.py <project_path_or_url> [<url_if_first_is_path>] [--screenshot] [--a11y]
Output: JSON with page info, health status, and optional screenshot path
Note: Requires playwright (pip install playwright && playwright install chromium)
Screenshots: Saved to system temp directory (auto-cleaned by OS)
"""
import sys
import json
import os
import tempfile
from datetime import datetime

# Fix Windows console encoding for Unicode output
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass  # Python < 3.7

try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


def run_basic_test(
    url: str,
    take_screenshot: bool = False,
    viewport: dict = None,
    user_agent: str = None,
    timeout_ms: int = 30000
) -> dict:
    """Run basic browser test on URL."""
    if not PLAYWRIGHT_AVAILABLE:
        return {
            "error": "Playwright not installed",
            "fix": "pip install playwright && playwright install chromium"
        }
    
    result = {
        "url": url,
        "timestamp": datetime.now().isoformat(),
        "status": "pending"
    }
    
    # Defaults if not provided
    if viewport is None:
        viewport = {"width": 1280, "height": 720}
    if user_agent is None:
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport=viewport,
                user_agent=user_agent
            )
            page = context.new_page()
            
            # Navigate
            response = page.goto(url, wait_until="networkidle", timeout=timeout_ms)
            
            # Basic info
            result["page"] = {
                "title": page.title(),
                "url": page.url,
                "status_code": response.status if response else None
            }
            
            # Health checks
            result["health"] = {
                "loaded": response.ok if response else False,
                "has_title": bool(page.title()),
                "has_h1": page.locator("h1").count() > 0,
                "has_links": page.locator("a").count() > 0,
                "has_images": page.locator("img").count() > 0
            }
            
            # Console errors
            console_errors = []
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            
            # Performance metrics
            result["performance"] = {
                "dom_content_loaded": page.evaluate("window.performance.timing.domContentLoadedEventEnd - window.performance.timing.navigationStart"),
                "load_complete": page.evaluate("window.performance.timing.loadEventEnd - window.performance.timing.navigationStart")
            }
            
            # Screenshot - uses system temp directory (cross-platform, auto-cleaned)
            if take_screenshot:
                # Cross-platform: Windows=%TEMP%, Linux/macOS=/tmp
                screenshot_dir = os.path.join(tempfile.gettempdir(), "maestro_screenshots")
                os.makedirs(screenshot_dir, exist_ok=True)
                screenshot_path = os.path.join(screenshot_dir, f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png")
                page.screenshot(path=screenshot_path, full_page=True)
                result["screenshot"] = screenshot_path
                result["screenshot_note"] = "Saved to temp directory (auto-cleaned by OS)"
            
            # Element counts
            result["elements"] = {
                "links": page.locator("a").count(),
                "buttons": page.locator("button").count(),
                "inputs": page.locator("input").count(),
                "images": page.locator("img").count(),
                "forms": page.locator("form").count()
            }
            
            browser.close()
            
            result["status"] = "success" if result["health"]["loaded"] else "failed"
            result["summary"] = "[OK] Page loaded successfully" if result["status"] == "success" else "[X] Page failed to load"
            
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        result["summary"] = f"[X] Error: {str(e)[:100]}"
    
    return result


def run_accessibility_check(
    url: str,
    timeout_ms: int = 30000
) -> dict:
    """Run basic accessibility check."""
    if not PLAYWRIGHT_AVAILABLE:
        return {"error": "Playwright not installed"}
    
    result = {"url": url, "accessibility": {}}
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, wait_until="networkidle", timeout=timeout_ms)
            
            # Basic a11y checks
            result["accessibility"] = {
                "images_with_alt": page.locator("img[alt]").count(),
                "images_without_alt": page.locator("img:not([alt])").count(),
                "buttons_with_label": page.locator("button[aria-label], button:has-text('')").count(),
                "links_with_text": page.locator("a:has-text('')").count(),
                "form_labels": page.locator("label").count(),
                "headings": {
                    "h1": page.locator("h1").count(),
                    "h2": page.locator("h2").count(),
                    "h3": page.locator("h3").count()
                }
            }
            
            browser.close()
            result["status"] = "success"
            
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
    
    return result


if __name__ == "__main__":
    # 1. Default configuration parameters
    project_path = "."
    url = None
    take_screenshot = False
    check_a11y = False
    viewport = {"width": 1280, "height": 720}
    timeout_ms = 30000
    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

    # 2. Parse command-line flags
    args_without_flags = []
    for arg in sys.argv[1:]:
        if arg == "--screenshot":
            take_screenshot = True
        elif arg == "--a11y":
            check_a11y = True
        else:
            args_without_flags.append(arg)

    # 3. Analyze positional arguments to allow flexibility:
    #    Case A: playwright_runner.py <url>
    #    Case B: playwright_runner.py <project_path> <url>
    if len(args_without_flags) >= 1:
        arg1 = args_without_flags[0]
        if arg1.startswith("http://") or arg1.startswith("https://"):
            url = arg1
            project_path = "."
        else:
            project_path = arg1
            if len(args_without_flags) >= 2:
                url = args_without_flags[1]

    # 4. Attempt to load config.json from project_path or active workspace
    config_paths = [
        os.path.join(project_path, ".agent", "skills", "webapp-testing", "config.json"),
        os.path.join(project_path, "skills", "webapp-testing", "config.json"),
        os.path.join(os.getcwd(), ".agent", "skills", "webapp-testing", "config.json"),
        os.path.join(os.getcwd(), "skills", "webapp-testing", "config.json"),
    ]

    config_loaded = False
    for config_path in config_paths:
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    config = json.load(f)
                    # Use config settings if not explicitly passed on the command line
                    if not url and "url" in config:
                        url = config["url"]
                    if not take_screenshot and "take_screenshot" in config:
                        take_screenshot = config["take_screenshot"]
                    if not check_a11y and "check_a11y" in config:
                        check_a11y = config["check_a11y"]
                    if "viewport" in config:
                        viewport = config["viewport"]
                    if "timeout_ms" in config:
                        timeout_ms = config["timeout_ms"]
                    if "user_agent" in config:
                        user_agent = config["user_agent"]
                    config_loaded = True
                    break
            except Exception as e:
                sys.stderr.write(f"Warning: Failed to load config from {config_path}: {e}\n")

    # 5. Check if we ended up with a URL
    if not url:
        sys.stderr.write("Error: No target URL specified. Please provide a URL in config.json or as a CLI argument.\n")
        print(json.dumps({
            "error": "Missing URL",
            "usage": "python playwright_runner.py <project_path_or_url> [<url>] [--screenshot] [--a11y]"
        }, indent=2))
        sys.exit(1)

    # 6. Execute checks
    if check_a11y:
        result = run_accessibility_check(url, timeout_ms)
    else:
        result = run_basic_test(
            url=url,
            take_screenshot=take_screenshot,
            viewport=viewport,
            user_agent=user_agent,
            timeout_ms=timeout_ms
        )
    
    print(json.dumps(result, indent=2))
