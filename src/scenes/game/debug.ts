export type DebugFlags = {
  debugGrab: boolean;
};

export function getDebugFlags(search: string): DebugFlags {
  const params = new URLSearchParams(search);
  return {
    debugGrab: params.get('debugGrab') === '1',
  };
}
