export function stableShuffle<T>(items: T[], seed = 20260703): T[] {
  const result = [...items];
  let value = seed;
  const random = () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function pickRandomIndex(length: number, avoidIndex?: number): number {
  if (length <= 1) return 0;
  let index = Math.floor(Math.random() * length);
  if (avoidIndex !== undefined && index === avoidIndex) {
    index = (index + 1 + Math.floor(Math.random() * (length - 1))) % length;
  }
  return index;
}

export function uid(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}
