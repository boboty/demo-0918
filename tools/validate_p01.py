#!/usr/bin/env python3
"""Validate the P01 mock data pack with Python's standard library only."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = ROOT / 'data' / 'schema'
SAMPLE_DIR = ROOT / 'data' / 'samples'
FILES = {
    'organization': ('organizations.json', 'organization_id'),
    'project': ('projects.json', 'project_id'),
    'source': ('sources.json', 'source_id'),
    'evidence': ('evidence.json', 'evidence_id'),
    'fact': ('facts.json', 'fact_id'),
    'project_event': ('project_events.json', 'event_id'),
    'metric': ('metrics.json', 'metric_id'),
    'judgment': ('judgments.json', 'judgment_id'),
}
PREFIXES = {
    'organization': 'ORG-', 'project': 'PRJ-', 'source': 'SRC-',
    'evidence': 'EVD-', 'fact': 'FCT-', 'project_event': 'EVT-',
    'metric': 'MET-', 'judgment': 'JDG-',
}
KNOWLEDGE = {'known', 'unknown', 'pending_confirmation', 'conflicting'}
errors = []


def fail(message):
    errors.append(message)


def load_json(path):
    try:
        with path.open(encoding='utf-8') as stream:
            return json.load(stream)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        fail(f'{path.relative_to(ROOT)}: cannot parse JSON: {exc}')
        return None


def check_no_empty_strings(value, location):
    if isinstance(value, str) and value == '':
        fail(f'{location}: empty string is not allowed; use knowledge_status for unknown')
    elif isinstance(value, dict):
        for key, item in value.items():
            check_no_empty_strings(item, f'{location}.{key}')
    elif isinstance(value, list):
        for index, item in enumerate(value):
            check_no_empty_strings(item, f'{location}[{index}]')


def lookup(index, kind, identifier, location):
    if not isinstance(identifier, str) or identifier not in index[kind]:
        fail(f'{location}: unresolved {kind} reference {identifier!r}')


def check_evidence_refs(row, index, location):
    refs = row.get('evidence_ids')
    if not isinstance(refs, list):
        fail(f'{location}.evidence_ids: expected an array')
        return
    if len(refs) != len(set(map(str, refs))):
        fail(f'{location}.evidence_ids: duplicate references')
    for ref in refs:
        lookup(index, 'evidence', ref, f'{location}.evidence_ids')


def check_subject(row, index, location):
    kind = row.get('subject_type')
    if kind not in ('organization', 'project'):
        fail(f'{location}.subject_type: expected organization or project')
    else:
        lookup(index, kind, row.get('subject_id'), f'{location}.subject_id')


def check_knowledge(row, location, value_field):
    status = row.get('knowledge_status')
    if status not in KNOWLEDGE:
        fail(f'{location}.knowledge_status: invalid or missing status {status!r}')
    if status == 'known' and value_field not in row:
        fail(f'{location}.{value_field}: known record needs a value')
    if status == 'unknown' and value_field in row:
        fail(f'{location}.{value_field}: unknown record must omit its value')
    if value_field in row and row[value_field] is None:
        fail(f'{location}.{value_field}: null is not a knowledge status')


def main():
    index = {kind: {} for kind in FILES}
    all_ids = set()

    for kind in FILES:
        schema_path = SCHEMA_DIR / f'{kind}.schema.json'
        schema = load_json(schema_path)
        if isinstance(schema, dict):
            if schema.get('$schema') != 'https://json-schema.org/draft/2020-12/schema':
                fail(f'{schema_path.relative_to(ROOT)}: expected JSON Schema draft 2020-12')
            for field in (FILES[kind][1], 'is_mock'):
                if field not in schema.get('required', []):
                    fail(f'{schema_path.relative_to(ROOT)}: {field} must be required')
        elif schema is not None:
            fail(f'{schema_path.relative_to(ROOT)}: expected a JSON object')

        filename, id_field = FILES[kind]
        path = SAMPLE_DIR / filename
        rows = load_json(path)
        if not isinstance(rows, list):
            fail(f'{path.relative_to(ROOT)}: expected an array of records')
            continue
        for number, row in enumerate(rows, 1):
            location = f'{path.relative_to(ROOT)}[{number}]'
            if not isinstance(row, dict):
                fail(f'{location}: expected an object')
                continue
            check_no_empty_strings(row, location)
            identifier = row.get(id_field)
            if not isinstance(identifier, str) or not identifier.startswith(PREFIXES[kind]):
                fail(f'{location}.{id_field}: missing or invalid ID')
            elif identifier in all_ids:
                fail(f'{location}.{id_field}: duplicate ID {identifier}')
            else:
                all_ids.add(identifier)
                index[kind][identifier] = row
            if row.get('is_mock') is not True:
                fail(f'{location}.is_mock: every sample record must be true')
            if kind == 'source' and row.get('data_origin') != 'mock':
                fail(f'{location}.data_origin: sample source must be mock')

    expected_schema = {f'{kind}.schema.json' for kind in FILES}
    expected_sample = {filename for filename, _ in FILES.values()}
    for directory, expected in ((SCHEMA_DIR, expected_schema), (SAMPLE_DIR, expected_sample)):
        for path in directory.glob('*.json'):
            if path.name not in expected:
                load_json(path)
                fail(f'{path.relative_to(ROOT)}: unexpected JSON file is outside the P01 entity pack')

    for oid, row in index['organization'].items():
        parent = row.get('parent_organization_id')
        if parent is not None:
            lookup(index, 'organization', parent, f'{oid}.parent_organization_id')
        seen = {oid}
        while isinstance(parent, str) and parent in index['organization']:
            if parent in seen:
                fail(f'{oid}: organization parent cycle')
                break
            seen.add(parent)
            parent = index['organization'][parent].get('parent_organization_id')

    for pid, row in index['project'].items():
        lookup(index, 'organization', row.get('owner_organization_id'), f'{pid}.owner_organization_id')

    for eid, row in index['evidence'].items():
        lookup(index, 'source', row.get('source_id'), f'{eid}.source_id')
        kind = row.get('target_type')
        if kind not in ('fact', 'project_event', 'metric'):
            fail(f'{eid}.target_type: invalid target type {kind!r}')
        else:
            lookup(index, kind, row.get('target_id'), f'{eid}.target_id')
        if row.get('relation') not in ('supports', 'contradicts', 'context'):
            fail(f'{eid}.relation: invalid relation')

    for kind in ('fact', 'project_event', 'metric'):
        for identifier, row in index[kind].items():
            if kind == 'project_event':
                lookup(index, 'project', row.get('project_id'), f'{identifier}.project_id')
            else:
                check_subject(row, index, identifier)
            check_evidence_refs(row, index, identifier)
            check_knowledge(row, identifier, 'event_date' if kind == 'project_event' else 'value')
            for evidence_id in row.get('evidence_ids', []) if isinstance(row.get('evidence_ids'), list) else []:
                evidence = index['evidence'].get(evidence_id)
                if evidence and (evidence.get('target_type'), evidence.get('target_id')) != (kind, identifier):
                    # A source excerpt can be represented by separate evidence records for separate targets.
                    fail(f'{identifier}.evidence_ids: {evidence_id} targets another record')

    for jid, row in index['judgment'].items():
        lookup(index, 'source', row.get('report_source_id'), f'{jid}.report_source_id')
        if not isinstance(row.get('premises'), list) or not row['premises']:
            fail(f'{jid}.premises: expected at least one premise')
        if not isinstance(row.get('evidence_version'), str) or not row['evidence_version']:
            fail(f'{jid}.evidence_version: expected a nonempty version')
        refs = row.get('dependency_refs')
        if not isinstance(refs, list):
            fail(f'{jid}.dependency_refs: expected an array')
            continue
        for number, ref in enumerate(refs, 1):
            if not isinstance(ref, dict):
                fail(f'{jid}.dependency_refs[{number}]: expected an object')
                continue
            kind = ref.get('target_type')
            if kind not in ('fact', 'metric', 'project_event'):
                fail(f'{jid}.dependency_refs[{number}]: invalid target type {kind!r}')
            else:
                lookup(index, kind, ref.get('target_id'), f'{jid}.dependency_refs[{number}]')
        if row.get('judgment_status') == 'active' and row.get('human_review_status') != 'confirmed':
            fail(f'{jid}: active judgment requires human confirmation')

    capacities = {}
    for mid, row in index['metric'].items():
        if row.get('metric_name') in ('power_capacity', 'energy_capacity'):
            subject = (row.get('subject_type'), row.get('subject_id'))
            capacities.setdefault(subject, {}).setdefault(row.get('unit'), set()).add(mid)
        if row.get('metric_name') == 'power_capacity' and row.get('unit') != 'MW':
            fail(f'{mid}: power_capacity must use MW')
        if row.get('metric_name') == 'energy_capacity' and row.get('unit') != 'MWh':
            fail(f'{mid}: energy_capacity must use MWh')
    if not any(units.get('MW') and units.get('MWh') and units['MW'].isdisjoint(units['MWh'])
               for units in capacities.values()):
        fail('metrics: at least one subject needs separate MW and MWh metric records')

    if errors:
        print(f'FAIL P01 validation: {len(errors)} error(s)')
        for error in errors:
            print(f'  - {error}')
        return 1
    print('PASS P01 validation: JSON parsed; IDs, Mock flags, references, knowledge status and MW/MWh checked')
    print('Records: ' + ', '.join(f'{kind}={len(index[kind])}' for kind in FILES))
    return 0


if __name__ == '__main__':
    sys.exit(main())
