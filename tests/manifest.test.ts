import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadManifests,
  listCapabilities,
  getCapability,
  resetManifestCache,
} from '../src/lib/manifest-loader.js';

beforeEach(() => {
  resetManifestCache();
});

describe('loadManifests', () => {
  it('loads manifest files from manifests/ directory', () => {
    const manifests = loadManifests();
    expect(manifests.length).toBeGreaterThan(0);
    const linear = manifests.find(m => m.provider === 'linear');
    expect(linear).toBeDefined();
    expect(linear!.capabilities.length).toBeGreaterThan(0);
  });

  it('every capability has required fields', () => {
    const manifests = loadManifests();
    for (const manifest of manifests) {
      for (const cap of manifest.capabilities) {
        expect(cap.id).toBeTruthy();
        expect(cap.name).toBeTruthy();
        expect(cap.description).toBeTruthy();
        expect(cap.provider).toBeTruthy();
        expect(cap.resource).toBeTruthy();
        expect(cap.action).toBeTruthy();
        expect(['read', 'write_propose', 'admin']).toContain(cap.risk);
        expect(cap.input_schema).toBeDefined();
        expect(cap.output_schema).toBeDefined();
        expect(cap.cli).toBeDefined();
        expect(cap.cli.command).toBeTruthy();
      }
    }
  });
});

describe('listCapabilities', () => {
  it('returns all capabilities as summaries', () => {
    const list = listCapabilities();
    expect(list.length).toBeGreaterThan(0);

    for (const item of list) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(['read', 'write_propose', 'admin']).toContain(item.risk);
      expect(item.cli.command).toBeTruthy();
    }
  });

  it('includes Linear team search', () => {
    const list = listCapabilities();
    const team = list.find(c => c.id === 'linear.team.search');
    expect(team).toBeDefined();
    expect(team!.risk).toBe('read');
    expect(team!.cli.command).toBe('linear team search');
  });

  it('includes Linear comment propose with write_propose risk', () => {
    const list = listCapabilities();
    const comment = list.find(c => c.id === 'linear.comment.propose');
    expect(comment).toBeDefined();
    expect(comment!.risk).toBe('write_propose');
  });
});

describe('getCapability', () => {
  it('returns full detail for a known capability', () => {
    const cap = getCapability('linear.issue.search');
    expect(cap).not.toBeNull();
    expect(cap!.id).toBe('linear.issue.search');
    expect(cap!.risk).toBe('read');
    expect(cap!.input_schema.type).toBe('object');
    expect(cap!.output_schema.type).toBe('object');
  });

  it('returns null for unknown capability', () => {
    const cap = getCapability('nonexistent.cap');
    expect(cap).toBeNull();
  });
});
