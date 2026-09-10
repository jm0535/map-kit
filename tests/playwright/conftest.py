"""Shared helpers for GeoSpaX Playwright tests."""
import asyncio
from playwright.async_api import async_playwright

BASE = "http://localhost:8931/index.html"
CHROME = "/usr/bin/google-chrome"
CHROME_ARGS = ["--no-sandbox", "--headless=old", "--disable-gpu", "--disable-dev-shm-usage"]

COUNTS = {"pass": 0, "fail": 0}
RESULTS = []

def report(name, ok, detail=""):
    if ok:
        COUNTS["pass"] += 1
        RESULTS.append(f"PASS  {name}" + (f"  ({detail})" if detail else ""))
        print(f"PASS  {name}" + (f"  ({detail})" if detail else ""))
    else:
        COUNTS["fail"] += 1
        RESULTS.append(f"FAIL  {name}  {detail}")
        print(f"FAIL  {name}  {detail}")

async def new_page(p, viewport=None):
    b = await p.chromium.launch(executable_path=CHROME, args=CHROME_ARGS)
    ctx = await b.new_context(viewport=viewport or {"width": 1400, "height": 900})
    page = await ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page._gsx_errors = errs
    page._gsx_browser = b
    return page

async def close(page):
    errs = page._gsx_errors
    await page._gsx_browser.close()
    return errs

async def goto(page, wait=3000):
    await page.goto(BASE, wait_until="domcontentloaded", timeout=30000)
    await page.wait_for_timeout(wait)

async def upload_file(page, selector, path):
    await page.set_input_files(selector, path)
    await page.wait_for_timeout(1500)

async def expand_all_sections(page):
    """Expand all collapsed panel sections so elements become visible."""
    await page.evaluate("""() => {
        document.querySelectorAll('#left-panel .panel-header.collapsed, #right-panel .panel-header.collapsed').forEach(h => {
            h.classList.remove('collapsed');
            const body = h.nextElementSibling;
            if (body && body.classList.contains('panel-body')) body.classList.remove('hidden');
            const section = h.parentElement;
            if (section && section.dataset._origFlex) section.style.flex = section.dataset._origFlex;
        });
        document.querySelectorAll('#analysis-drawer-body .ad-section-title.collapsed').forEach(t => {
            t.classList.remove('collapsed');
            let el = t.nextElementSibling;
            while (el && !el.classList.contains('ad-section-title')) {
                el.classList.remove('ad-collapsed');
                el = el.nextElementSibling;
            }
        });
    }""")
    await page.wait_for_timeout(300)

async def js_click(page, selector):
    """Click an element via JS, bypassing Playwright visibility checks."""
    await page.evaluate("""(sel) => {
        const el = document.querySelector(sel);
        if (el) el.click();
    }""", selector)
