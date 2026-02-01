import { describe, it, expect } from 'vitest';
import { parseKeywords, cleanKeywords } from '../keywords';

describe('parseKeywords', () => {
  it('should split comma-separated keywords', () => {
    const result = parseKeywords('cat, dog, bird');
    expect(result).toEqual(['cat', 'dog', 'bird']);
  });

  it('should trim whitespace from keywords', () => {
    const result = parseKeywords('  cat  ,  dog  ,  bird  ');
    expect(result).toEqual(['cat', 'dog', 'bird']);
  });

  it('should filter out empty strings', () => {
    const result = parseKeywords('cat,,dog,  ,bird');
    expect(result).toEqual(['cat', 'dog', 'bird']);
  });

  it('should handle empty input', () => {
    expect(parseKeywords('')).toEqual([]);
    expect(parseKeywords('   ')).toEqual([]);
  });

  it('should handle single keyword', () => {
    const result = parseKeywords('cat');
    expect(result).toEqual(['cat']);
  });
});

describe('cleanKeywords', () => {
  it('should deduplicate keywords case-insensitively', () => {
    const result = cleanKeywords('Cat, cat, CAT, dog', 10);
    expect(result).toBe('Cat, dog');
  });

  it('should preserve original case of first occurrence', () => {
    const result = cleanKeywords('Dog, DOG, dog', 10);
    expect(result).toBe('Dog');
  });

  it('should truncate to target count', () => {
    const result = cleanKeywords('a, b, c, d, e, f, g, h, i, j', 5);
    expect(result).toBe('a, b, c, d, e');
  });

  it('should handle count larger than unique keywords', () => {
    const result = cleanKeywords('a, b, c', 10);
    expect(result).toBe('a, b, c');
  });

  it('should handle empty input', () => {
    expect(cleanKeywords('', 5)).toBe('');
  });

  it('should combine deduplication and truncation', () => {
    const result = cleanKeywords('Cat, cat, Dog, dog, Bird, bird, Fish', 3);
    expect(result).toBe('Cat, Dog, Bird');
  });
});
