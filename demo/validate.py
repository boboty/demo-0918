#!/usr/bin/env python3
"""Check the demo's P01 records against the checked-in P01 JSON Schema subset."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'demo/data.json').read_text())
real = json.loads((ROOT / 'demo/real-project.json').read_text())
monitor = json.loads((ROOT / 'demo/monitor-task.json').read_text())
collections = {
    'organization': [real['organization']],
    'project': [data['project'], real['project']],
    'source': data['sources'] + [data['inbox']['source']] + real['sources'],
    'evidence': data['evidence'] + [data['inbox']['evidence']] + real['evidence'],
    'metric': data['metrics'] + [data['inbox']['metric']] + real['metrics'],
    'project_event': data['events'] + real['events'],
    'judgment': data['judgments'] + [data['draft_template']] + monitor['judgments'] + [monitor['draft_template']],
}

def check(value, spec, path):
    if 'oneOf' in spec:
        assert sum(matches(value, part) for part in spec['oneOf']) == 1, f'{path}: oneOf'
        return
    kind = spec.get('type')
    if kind == 'object':
        assert isinstance(value, dict), f'{path}: expected object'
        for key in spec.get('required', []):
            assert key in value, f'{path}: missing {key}'
        if spec.get('additionalProperties') is False:
            assert not set(value) - set(spec['properties']), f'{path}: extra fields {set(value)-set(spec["properties"])}'
        for key, item in value.items():
            check(item, spec.get('properties', {}).get(key, {}), f'{path}.{key}')
    elif kind == 'array':
        assert isinstance(value, list), f'{path}: expected array'
        assert len(value) >= spec.get('minItems', 0), f'{path}: too few items'
        if spec.get('uniqueItems'):
            assert len({json.dumps(x, sort_keys=True) for x in value}) == len(value), f'{path}: duplicate items'
        for index, item in enumerate(value): check(item, spec.get('items', {}), f'{path}[{index}]')
    elif kind == 'string':
        assert isinstance(value, str), f'{path}: expected string'
        assert len(value) >= spec.get('minLength', 0), f'{path}: too short'
        if 'pattern' in spec: assert re.fullmatch(spec['pattern'], value), f'{path}: pattern'
    elif kind == 'integer': assert isinstance(value, int) and not isinstance(value, bool) and value >= spec.get('minimum', 0), f'{path}: integer'
    elif kind == 'number': assert isinstance(value, (int, float)) and not isinstance(value, bool), f'{path}: number'
    elif kind == 'boolean': assert isinstance(value, bool), f'{path}: boolean'
    elif kind == 'null': assert value is None, f'{path}: null'
    if 'enum' in spec: assert value in spec['enum'], f'{path}: enum'

def matches(value, spec):
    try: check(value, spec, 'oneOf'); return True
    except (AssertionError, TypeError): return False

for kind, rows in collections.items():
    schema = json.loads((ROOT / f'data/schema/{kind}.schema.json').read_text())
    for index, row in enumerate(rows):
        check(row, schema, f'{kind}[{index}]')
        if kind == 'metric' and row['metric_name'] in ('power_capacity', 'energy_capacity'):
            assert 'lifecycle_stage' in row, f'{kind}[{index}]: missing lifecycle_stage'
assert real['project']['owner_organization_id'] == real['organization']['organization_id']
assert real['research_project_id'] == 'PRJ-C03'
assert set(real['research_source_ids'].values()) == {'SRC-C09', 'SRC-C10'}
assert all(not row['is_mock'] and row['data_origin'] == 'real' for row in real['sources'])
assert all(not row['is_mock'] for row in [real['project'], real['organization'], *real['evidence'], *real['metrics'], *real['events']])
assert monitor['schedule']['enabled'] and monitor['schedule']['cron'] == '0 8 * * *'
assert monitor['snapshots']['previous']['source_ids'] == ['SRC-009']
assert monitor['snapshots']['current']['source_ids'] == ['SRC-009', 'SRC-010']
assert all(row['is_mock'] for row in monitor['judgments'] + [monitor['draft_template']])
print('Demo records conform to P01 schemas; real and Mock records remain separate')
