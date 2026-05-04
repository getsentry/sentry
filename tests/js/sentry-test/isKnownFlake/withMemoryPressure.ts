import {invokeProvidesCallback} from './flakeStressUtils';

const chunkSizeBytes = 64 * 1024;
/** 1024 × 64 KiB ≈ 64 MiB fragmented across many allocations (heap / GC pressure). */
const chunkCount = 1024;

/**
 * Simulates low available memory by retaining a large buffer of bytes data.
 */
export function withMemoryPressure(fn: jest.ProvidesCallback): jest.ProvidesCallback {
  return function wrapped(this: unknown) {
    return (async () => {
      const buffers: Uint8Array[] = [];
      for (let c = 0; c < chunkCount; c++) {
        const chunk = new Uint8Array(chunkSizeBytes);
        chunk[0] = 1;
        chunk[chunkSizeBytes - 1] = 1;
        buffers.push(chunk);
      }

      try {
        await invokeProvidesCallback(fn, this);
      } finally {
        for (const chunk of buffers) {
          chunk.fill(0);
        }
        buffers.length = 0;
      }
    })();
  };
}
