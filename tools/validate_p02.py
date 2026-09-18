#!/usr/bin/env python3
"""Validate the P02 rule pack using only the Python standard library."""

import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULES = ROOT / 'rules'
CASES = ROOT / 'tests' / 'fixtures' / 'p02-rule-cases.json'
RULE_FILES = {
    'ER': ('01-entity-resolution.md', 'entity_resolution'),
    'EG': ('02-evidence-grading.md', 'evidence_grading'),
    'PS': ('03-project-status.md', 'project_status'),
    'SC': ('04-source-conflict.md', 'source_conflict'),
    'MN': ('05-metric-normalization.md', 'metric_normalization'),
    'JI': ('06-judgment-impact.md', 'judgment_impact'),
}
LEVELS = {'automatic', 'ai_proposes_human_confirms', 'human_only'}
FROZEN = [
    'docs/01-product-definition.md',
    'docs/02-data-model.md',
    'data/schema/',
    'data/samples/',
]
ERRORS = []


def fail(message):
    ERRORS.append(message)


def read_json(path):
    try:
        with path.open(encoding='utf-8') as stream:
            return json.load(stream)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        fail(f'{path.relative_to(ROOT)}: cannot parse JSON: {exc}')
        return None


def valid_rule_id(value):
    return isinstance(value, str) and re.fullmatch(r'(ER|EG|PS|SC|MN|JI)-[0-9]{3}', value)


def validate_frozen():
    # HEAD is the pre-existing committed baseline. This script embeds no file hashes.
    command = ['git', 'status', '--porcelain=v1', '--', *FROZEN]
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=False)
    if result.returncode:
        fail(f'cannot check frozen assets against Git HEAD: {result.stderr.strip()}')
    elif result.stdout.strip():
        fail('frozen P01 assets differ from Git HEAD: ' + result.stdout.strip().replace('\n', '; '))


def main():
    catalog = read_json(RULES / 'rule-catalog.json')
    if not isinstance(catalog, list):
        fail('rule-catalog.json: expected an array')
        catalog = []
    catalog_ids = set()
    catalog_categories = set()
    for number, rule in enumerate(catalog, 1):
        location = f'rule-catalog.json[{number}]'
        if not isinstance(rule, dict):
            fail(f'{location}: expected an object')
            continue
        rule_id = rule.get('rule_id')
        if not valid_rule_id(rule_id):
            fail(f'{location}: invalid Rule ID {rule_id!r}')
            continue
        if rule_id in catalog_ids:
            fail(f'{location}: duplicate Rule ID {rule_id}')
        catalog_ids.add(rule_id)
        prefix = rule_id[:2]
        expected_category = RULE_FILES[prefix][1]
        if rule.get('category') != expected_category:
            fail(f'{location}: category must be {expected_category}')
        catalog_categories.add(rule.get('category'))
        if not isinstance(rule.get('title'), str) or not rule['title'].strip():
            fail(f'{location}: missing title')
        if rule.get('automation_level') not in LEVELS:
            fail(f'{location}: invalid automation_level {rule.get("automation_level")!r}')

    markdown_ids = []
    required_fields = (
        '输入条件', '判断逻辑', '输出结果', '是否允许 AI 自动执行',
        '是否要求人工确认', '示例', '例外或边界',
    )
    for prefix, (filename, _) in RULE_FILES.items():
        path = RULES / filename
        try:
            content = path.read_text(encoding='utf-8')
        except (OSError, UnicodeError) as exc:
            fail(f'{path.relative_to(ROOT)}: missing or unreadable: {exc}')
            continue
        sections = re.split(r'(?=^## [A-Z]{2}-\d{3} )', content, flags=re.MULTILINE)
        found = False
        for section in sections:
            match = re.match(r'^## ([A-Z]{2}-\d{3}) ', section)
            if not match:
                continue
            found = True
            rule_id = match.group(1)
            markdown_ids.append(rule_id)
            if not valid_rule_id(rule_id) or not rule_id.startswith(prefix + '-'):
                fail(f'{filename}: invalid or misplaced Rule ID {rule_id}')
            for field in required_fields:
                if not re.search(rf'^- {re.escape(field)}：\S', section, re.MULTILINE):
                    fail(f'{filename} {rule_id}: missing {field}')
        if not found:
            fail(f'{filename}: no Rule ID sections found')
    duplicates = [rule_id for rule_id, count in Counter(markdown_ids).items() if count > 1]
    if duplicates:
        fail(f'Markdown Rule IDs repeated: {duplicates}')
    for rule_id in sorted(catalog_ids - set(markdown_ids)):
        fail(f'{rule_id}: in catalog but missing from Markdown')
    for rule_id in sorted(set(markdown_ids) - catalog_ids):
        fail(f'{rule_id}: in Markdown but missing from catalog')

    cases = read_json(CASES)
    if not isinstance(cases, list):
        fail('p02-rule-cases.json: expected an array')
        cases = []
    if len(cases) < 19:
        fail(f'p02-rule-cases.json: expected at least 19 cases, got {len(cases)}')
    case_ids = set()
    case_categories = set()
    for number, case in enumerate(cases, 1):
        location = f'p02-rule-cases.json[{number}]'
        if not isinstance(case, dict):
            fail(f'{location}: expected an object')
            continue
        case_id = case.get('case_id')
        if not isinstance(case_id, str) or not case_id.strip():
            fail(f'{location}: missing case_id')
        elif case_id in case_ids:
            fail(f'{location}: duplicate case_id {case_id}')
        case_ids.add(case_id)
        refs = case.get('rule_ids')
        if not isinstance(refs, list) or not refs:
            fail(f'{location}: rule_ids must be a nonempty array')
        else:
            for rule_id in refs:
                if rule_id not in catalog_ids:
                    fail(f'{location}: unknown Rule ID {rule_id!r}')
        category = case.get('category')
        if category not in {value[1] for value in RULE_FILES.values()}:
            fail(f'{location}: invalid category {category!r}')
        else:
            case_categories.add(category)
        if not isinstance(case.get('description'), str) or not case['description'].strip():
            fail(f'{location}: missing description')
        if not isinstance(case.get('input'), dict) or not case['input']:
            fail(f'{location}: input must be a nonempty object')
        output = case.get('expected_output')
        if output is None or output == '' or output == {} or output == []:
            fail(f'{location}: expected_output must not be empty')
    for category in {value[1] for value in RULE_FILES.values()} - case_categories:
        fail(f'{category}: no test case')
    for category in {value[1] for value in RULE_FILES.values()} - catalog_categories:
        fail(f'{category}: no catalog rule')
    validate_frozen()

    if ERRORS:
        print(f'FAIL P02 validation: {len(ERRORS)} error(s)')
        for error in ERRORS:
            print(f'  - {error}')
        return 1
    distribution = Counter(item['automation_level'] for item in catalog)
    print(f'PASS P02 validation: {len(catalog_ids)} rules, {len(cases)} cases, six categories, frozen P01 assets unchanged')
    print('Automation levels: ' + ', '.join(f'{name}={distribution[name]}' for name in sorted(LEVELS)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
