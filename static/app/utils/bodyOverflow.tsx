/**
 * Manages document.body.style.overflow with proper coordination across multiple
 * components that need to prevent body scroll (e.g., drawers, modals, overlays).
 *
 * Uses a stack-based approach to handle multiple overlapping requests:
 * - First call saves the original overflow value and sets it to 'hidden'
 * - Subsequent calls increment a reference counter
 * - Body overflow is only restored when all components have released their locks
 *
 * This prevents race conditions when multiple components are active simultaneously.
 */

let lockCount = 0;
let originalOverflow: string | null = null;

/**
 * Locks body scroll by setting overflow to 'hidden'.
 * Multiple calls are tracked via reference counting.
 *
 * @returns A cleanup function to release the lock
 */
export function lockBodyOverflow(): () => void {
  // Save the original value only on the first lock
  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  lockCount++;

  // Return cleanup function
  return unlockBodyOverflow;
}

/**
 * Releases a body scroll lock.
 * Body overflow is only restored when all locks have been released.
 */
function unlockBodyOverflow(): void {
  if (lockCount === 0) {
    return;
  }

  lockCount--;

  // Only restore overflow when all locks are released
  if (lockCount === 0 && originalOverflow !== null) {
    document.body.style.overflow = originalOverflow;
    originalOverflow = null;
  }
}
