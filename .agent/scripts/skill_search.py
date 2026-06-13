#!/usr/bin/env python3
"""
skill_search.py
Purpose: Semantic-like local skill indexer and search engine.
Generates a local index (TF-IDF, word bigrams, character n-grams, synonym expansion) from SKILL.md files.
"""

import os
import sys
import re
import json
import math
import pathlib
import collections
from typing import Dict, List, Set, Any

# Common English stopwords to filter out from vocabulary.
STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "as", "at",
    "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can", "cannot",
    "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from", "further",
    "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him", "himself", "his",
    "how", "i", "if", "in", "into", "is", "it", "its", "itself", "me", "more", "most", "my", "myself",
    "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
    "ourselves", "out", "over", "own", "same", "she", "should", "so", "some", "such", "than", "that",
    "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they", "this", "those",
    "through", "to", "too", "under", "until", "up", "very", "was", "we", "were", "what", "when",
    "where", "which", "while", "who", "whom", "why", "with", "would", "you", "your", "yours",
    "yourself", "yourselves"
}

# Domain-specific synonym mappings to enable semantic-like query expansion.
SYNONYMS = {
    "auth": ["login", "signup", "password", "credentials", "jwt", "token", "session", "authentication", "authorization"],
    "login": ["auth", "signup", "password", "credentials", "jwt", "token", "session", "authentication", "authorization"],
    "signup": ["auth", "login", "password", "credentials", "jwt", "token", "session", "authentication", "authorization"],
    "authentication": ["auth", "login", "signup", "password", "credentials", "jwt", "token", "session", "authorization"],
    "authorization": ["auth", "login", "signup", "password", "credentials", "jwt", "token", "session", "authentication"],
    "ui": ["ux", "frontend", "css", "html", "tailwind", "design", "layout", "component", "styling", "visual"],
    "ux": ["ui", "frontend", "css", "html", "tailwind", "design", "layout", "component", "styling", "visual"],
    "frontend": ["ui", "ux", "css", "html", "tailwind", "design", "layout", "component", "styling", "visual"],
    "design": ["ui", "ux", "frontend", "css", "html", "tailwind", "layout", "component", "styling", "visual"],
    "tailwind": ["ui", "ux", "frontend", "css", "html", "design", "layout", "component", "styling"],
    "performance": ["speed", "lighthouse", "fast", "optimize", "profiling", "vitals", "slow", "metric"],
    "speed": ["performance", "lighthouse", "fast", "optimize", "profiling", "vitals", "slow", "metric"],
    "optimize": ["performance", "speed", "lighthouse", "fast", "profiling", "vitals", "slow", "metric"],
    "seo": ["geo", "meta", "rank", "sitemap", "search", "google", "optimization"],
    "geo": ["seo", "meta", "rank", "sitemap", "search", "google", "optimization"],
    "test": ["testing", "playwright", "jest", "vitest", "e2e", "unit", "coverage", "qa", "validation"],
    "testing": ["test", "playwright", "jest", "vitest", "e2e", "unit", "coverage", "qa", "validation"],
    "db": ["database", "sql", "nosql", "schema", "migration", "prisma", "postgres", "mysql", "mongo"],
    "database": ["db", "sql", "nosql", "schema", "migration", "prisma", "postgres", "mysql", "mongo"],
    "schema": ["db", "database", "sql", "nosql", "migration", "prisma", "postgres", "mysql", "mongo"],
    "security": ["vulnerability", "scan", "audit", "exploit", "hacker", "owasp", "protect", "penetration", "threat"],
    "vulnerability": ["security", "scan", "audit", "exploit", "hacker", "owasp", "protect", "penetration", "threat"],
    "ops": ["devops", "deploy", "docker", "kubernetes", "ci", "cd", "pipeline"],
    "devops": ["ops", "deploy", "docker", "kubernetes", "ci", "cd", "pipeline"],
    "deploy": ["ops", "devops", "docker", "kubernetes", "ci", "cd", "pipeline"],
    "mobile": ["ios", "android", "react-native", "flutter", "app"],
    "ios": ["mobile", "android", "react-native", "flutter", "app"],
    "android": ["mobile", "ios", "react-native", "flutter", "app"],
    "clean": ["refactor", "lint", "format", "eslint", "prettier", "standards"],
    "refactor": ["clean", "lint", "format", "eslint", "prettier", "standards"]
}


def get_skill_md_files() -> List[pathlib.Path]:
    """Finds all SKILL.md files in the repository and active project workspace."""
    search_dirs = [
        pathlib.Path("skills"),
        pathlib.Path(".agent/skills"),
        pathlib.Path(__file__).parent.parent / "skills",
        pathlib.Path(__file__).parent.parent.parent / "skills"
    ]
    
    found_files = set()
    for d in search_dirs:
        if d.exists() and d.is_dir():
            for p in d.glob("**/SKILL.md"):
                found_files.add(p.resolve())
                
    return sorted(list(found_files))


def get_index_path() -> pathlib.Path:
    """Returns the resolved path to store skills_index.json."""
    cwd_agent = pathlib.Path(".agent")
    if cwd_agent.exists() and cwd_agent.is_dir():
        return cwd_agent / "skills_index.json"
    
    script_agent = pathlib.Path(__file__).parent.parent
    if script_agent.name == ".agent":
        return script_agent / "skills_index.json"
        
    return pathlib.Path("skills_index.json")


def parse_skill_md(file_path: pathlib.Path) -> Dict[str, str]:
    """Parses frontmatter metadata and markdown content from a SKILL.md file."""
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        content = ""
        
    meta = {}
    frontmatter_match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    body = content
    
    if frontmatter_match:
        frontmatter_text = frontmatter_match.group(1)
        body = content[frontmatter_match.end():]
        for line in frontmatter_text.split("\n"):
            if ":" in line:
                key, val = line.split(":", 1)
                meta[key.strip().lower()] = val.strip()
                
    if "name" not in meta:
        meta["name"] = file_path.parent.name
        
    return {
        "slug": file_path.parent.name,
        "name": meta.get("name", file_path.parent.name),
        "description": meta.get("description", ""),
        "body": body
    }


def preprocess_and_vectorize(text_fields: Dict[str, str], expand_synonyms: bool = True) -> Dict[str, float]:
    """
    Transforms text fields into token counts with weighting, bigrams,
    character n-grams, and synonym expansion.
    """
    field_weights = {
        "name": 5.0,
        "description": 3.0,
        "body": 1.0
    }
    
    term_freqs = collections.defaultdict(float)
    
    for field, text in text_fields.items():
        if not text:
            continue
        weight = field_weights.get(field, 1.0)
        
        # Clean text: keep alphanumeric and lowercase
        text_clean = re.sub(r"[^a-zA-Z0-9\s-]", " ", text.lower())
        words = [w for w in text_clean.split() if w and w not in STOP_WORDS]
        
        for i, word in enumerate(words):
            # 1. Base word
            term_freqs[word] += 1.0 * weight
            
            # 2. Synonym expansion
            if expand_synonyms and word in SYNONYMS:
                for syn in SYNONYMS[word]:
                    term_freqs[syn] += 0.4 * weight
                    
            # 3. Subword / character n-grams (fuzzy matching)
            if len(word) >= 3:
                for j in range(len(word) - 2):
                    tri = f"char:{word[j:j+3]}"
                    term_freqs[tri] += 0.2 * weight
                if len(word) >= 4:
                    for j in range(len(word) - 3):
                        quad = f"char:{word[j:j+4]}"
                        term_freqs[quad] += 0.1 * weight
                        
        # 4. Word bigrams for phrase matching
        for i in range(len(words) - 1):
            bigram = f"bi:{words[i]}_{words[i+1]}"
            term_freqs[bigram] += 0.8 * weight
            
    return term_freqs


def build_index(skill_paths: List[pathlib.Path]) -> Dict[str, Any]:
    """Builds a TF-IDF index model from all SKILL.md documents."""
    skills_data = {}
    all_term_freqs = {}
    
    # Preprocess all documents
    for path in skill_paths:
        parsed = parse_skill_md(path)
        slug = parsed["slug"]
        
        fields = {
            "name": parsed["name"],
            "description": parsed["description"],
            "body": parsed["body"]
        }
        
        tf = preprocess_and_vectorize(fields, expand_synonyms=True)
        all_term_freqs[slug] = tf
        skills_data[slug] = {
            "slug": slug,
            "name": parsed["name"],
            "description": parsed["description"]
        }
        
    doc_count = len(skills_data)
    if doc_count == 0:
        return {"skills": {}, "idf": {}}
        
    # Compute Document Frequency (DF)
    doc_freqs = collections.defaultdict(int)
    for tf in all_term_freqs.values():
        for token in tf.keys():
            doc_freqs[token] += 1
            
    # Compute Inverse Document Frequency (IDF)
    idf = {}
    for token, df in doc_freqs.items():
        idf[token] = math.log(1.0 + (doc_count / (1.0 + df)))
        
    # Calculate and unit-normalize TF-IDF vectors
    for slug, tf in all_term_freqs.items():
        tfidf = {}
        for token, freq in tf.items():
            tfidf[token] = freq * idf.get(token, 0.0)
            
        squared_sum = sum(v * v for v in tfidf.values())
        norm = math.sqrt(squared_sum)
        
        normalized_vector = {}
        if norm > 0:
            for token, val in tfidf.items():
                normalized_vector[token] = val / norm
                
        skills_data[slug]["vector"] = normalized_vector
        
    return {
        "skills": skills_data,
        "idf": idf
    }


def search(query: str, index: Dict[str, Any], top_k: int = 3) -> List[Dict[str, Any]]:
    """Calculates cosine similarity of the query vector with all skill vectors."""
    if not index or not index.get("skills"):
        return []
        
    # Compute query TF-IDF vector
    query_tf = preprocess_and_vectorize({"body": query}, expand_synonyms=True)
    idf = index.get("idf", {})
    
    query_tfidf = {}
    for token, freq in query_tf.items():
        if token in idf:
            query_tfidf[token] = freq * idf[token]
            
    squared_sum = sum(v * v for v in query_tfidf.values())
    norm = math.sqrt(squared_sum)
    
    query_vector = {}
    if norm > 0:
        for token, val in query_tfidf.items():
            query_vector[token] = val / norm
            
    results = []
    for slug, skill in index["skills"].items():
        score = 0.0
        skill_vector = skill.get("vector", {})
        for token, val in query_vector.items():
            if token in skill_vector:
                score += val * skill_vector[token]
                
        results.append({
            "slug": slug,
            "name": skill["name"],
            "description": skill["description"],
            "score": round(score, 4)
        })
        
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_k]


def rebuild_index_if_needed(force: bool = False) -> Dict[str, Any]:
    """Loads existing index, or automatically builds/rebuilds if out of date."""
    index_path = get_index_path()
    skill_files = get_skill_md_files()
    
    rebuild = force or not index_path.exists()
    
    if not rebuild and index_path.exists():
        # Check if any skill file was modified after the index
        index_mtime = index_path.stat().st_mtime
        for f in skill_files:
            if f.stat().st_mtime > index_mtime:
                rebuild = True
                break
                
    if rebuild:
        index_data = build_index(skill_files)
        index_path.parent.mkdir(parents=True, exist_ok=True)
        index_path.write_text(json.dumps(index_data, indent=2), encoding="utf-8")
        return index_data
    else:
        try:
            return json.loads(index_path.read_text(encoding="utf-8"))
        except Exception:
            # Fallback to build if JSON error
            index_data = build_index(skill_files)
            index_path.write_text(json.dumps(index_data, indent=2), encoding="utf-8")
            return index_data


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 skill_search.py [build | search <query> | status]")
        sys.exit(1)
        
    cmd = sys.argv[1].lower()
    
    if cmd == "build":
        rebuild_index_if_needed(force=True)
        print(f"✔ Semantic index built successfully at {get_index_path()}")
        
    elif cmd == "status":
        index_path = get_index_path()
        skills = get_skill_md_files()
        print(f"Index Location: {index_path}")
        print(f"Status: {'Exists' if index_path.exists() else 'Missing'}")
        print(f"Found Skill Files: {len(skills)}")
        if index_path.exists():
            data = json.loads(index_path.read_text(encoding="utf-8"))
            print(f"Indexed Skills: {len(data.get('skills', {}))}")
            print(f"Indexed Vocabulary Size: {len(data.get('idf', {}))}")
            
    elif cmd == "search":
        if len(sys.argv) < 3:
            print("Error: Missing query string.")
            sys.exit(1)
        query = " ".join(sys.argv[2:])
        index = rebuild_index_if_needed()
        hits = search(query, index)
        
        print(json.dumps(hits, indent=2))
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
