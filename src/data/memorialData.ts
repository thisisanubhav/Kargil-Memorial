import type { AppLoadingManager } from '@/core/LoadingManager';

export interface MemorialEntry {
  readonly name: string;
  readonly rank: string;
  readonly award: string;
  readonly quote: string;
  readonly summary: string;
  /** Where this stone stands: along the trail (default) or on the summit. */
  readonly location?: 'trail' | 'summit';
}

export interface MemorialData {
  readonly plaque: {
    readonly lines: readonly string[];
  };
  /**
   * The collective dedication carved on the tablet behind the flag —
   * for every soldier who fell. A count and words, never invented names.
   */
  readonly fallen?: {
    readonly count: number;
    readonly lines: readonly string[];
  };
  readonly entries: readonly MemorialEntry[];
}

const DATA_URL = '/data/memorial.json';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
}

function assertEntry(value: unknown, index: number): asserts value is MemorialEntry {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`memorial.json: entry ${index} is not an object`);
  }
  for (const field of ['name', 'rank', 'award', 'quote', 'summary'] as const) {
    const text = (value as Record<string, unknown>)[field];
    if (typeof text !== 'string' || text.length === 0) {
      throw new Error(`memorial.json: entry ${index} is missing "${field}"`);
    }
  }
  const location = (value as Record<string, unknown>).location;
  if (location !== undefined && location !== 'trail' && location !== 'summit') {
    throw new Error(`memorial.json: entry ${index} has invalid "location"`);
  }
}

function validate(raw: unknown): MemorialData {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('memorial.json: root is not an object');
  }
  const data = raw as Record<string, unknown>;

  const plaque = data.plaque as Record<string, unknown> | undefined;
  if (!plaque || !isStringArray(plaque.lines)) {
    throw new Error('memorial.json: "plaque.lines" must be a non-empty string array');
  }

  if (!Array.isArray(data.entries) || data.entries.length === 0) {
    throw new Error('memorial.json: "entries" must be a non-empty array');
  }
  data.entries.forEach(assertEntry);

  const fallen = data.fallen as Record<string, unknown> | undefined;
  if (fallen !== undefined) {
    if (
      typeof fallen.count !== 'number' ||
      !Number.isFinite(fallen.count) ||
      fallen.count <= 0 ||
      !isStringArray(fallen.lines)
    ) {
      throw new Error('memorial.json: "fallen" needs a positive count and dedication lines');
    }
  }

  return raw as MemorialData;
}

/**
 * Fetches and validates the memorial content. All human-readable memorial
 * text lives in the JSON — code only decides how it is carved in stone.
 */
export async function loadMemorialData(loading?: AppLoadingManager): Promise<MemorialData> {
  const trackingKey = 'data:memorial';
  loading?.track(trackingKey, 'the roll of honour', 0.1);

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`memorial.json: HTTP ${response.status}`);
    }
    const data = validate(await response.json());
    loading?.markDone(trackingKey);
    return data;
  } catch (error) {
    loading?.markFailed(trackingKey, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
