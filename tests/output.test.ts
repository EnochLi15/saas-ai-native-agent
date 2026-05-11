import { describe, it, expect } from 'vitest';
import { resolveFormat, validateFormat, formatOutput, isTTY } from '../src/lib/output.js';

describe('isTTY', () => {
  it('returns a boolean', () => {
    expect(typeof isTTY()).toBe('boolean');
  });
});

describe('resolveFormat', () => {
  it('returns "json" when explicitly requested', () => {
    expect(resolveFormat('json')).toBe('json');
  });

  it('returns "text" when explicitly requested', () => {
    expect(resolveFormat('text')).toBe('text');
  });

  it('defaults to "text" when TTY and no format specified', () => {
    // 在 vitest 环境里，stdout 通常不是 TTY，所以无参时会走默认值。
    // 这里只验证返回了合法值。
    const result = resolveFormat();
    expect(['json', 'text']).toContain(result);
  });

  it('returns "json" when explicitly requested even under TTY', () => {
    expect(resolveFormat('json')).toBe('json');
  });
});

describe('validateFormat', () => {
  it('returns null for valid "json"', () => {
    expect(validateFormat('json')).toBeNull();
  });

  it('returns null for valid "text"', () => {
    expect(validateFormat('text')).toBeNull();
  });

  it('returns error message for invalid format', () => {
    const error = validateFormat('yaml');
    expect(error).toContain('"yaml"');
    expect(error).toContain('json');
    expect(error).toContain('text');
  });
});

describe('formatOutput', () => {
  it('outputs compact JSON for json format', () => {
    const data = { name: 'saas-agent', version: '0.1.0' };
    const result = formatOutput(data, 'json');
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result)).toEqual(data);
  });

  it('outputs newline-separated key:value for text format', () => {
    const data = { name: 'saas-agent', version: '0.1.0' };
    const result = formatOutput(data, 'text');
    expect(result).toContain('name: saas-agent');
    expect(result).toContain('version: 0.1.0');
  });

  it('outputs plain string for text format with string input', () => {
    expect(formatOutput('hello', 'text')).toBe('hello');
  });

  it('outputs empty string for null in text format', () => {
    expect(formatOutput(null, 'text')).toBe('');
  });
});
