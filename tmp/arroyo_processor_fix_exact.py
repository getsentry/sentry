"""
EXACT FIX FOR ARROYO STREAMPROCESSOR RACE CONDITION

This file contains the exact changes needed in the Arroyo repository:
https://github.com/getsentry/arroyo/blob/main/arroyo/processing/processor.py

PROBLEM ANALYSIS:
The issue occurs in the _run_once method around line 481 where this assertion fails:
    assert self.__consumer.poll(0.1) is None

This happens because:
1. Arroyo sets __is_paused = True during rebalancing
2. SynchronizedConsumer resumes partitions based on offset synchronization
3. The assertion expects poll() to return None when __is_paused is True
4. But poll() returns a message because partitions were resumed externally

SOLUTION:
Replace the problematic assertion logic with code that:
1. Checks the actual consumer pause state instead of relying on __is_paused flag
2. Handles the case where a message is received when expected to be paused
3. Updates __is_paused to reflect the actual consumer state
"""

# ORIGINAL CODE (around line 470-485 in _run_once method):
original_code = """
if self.__is_paused:
    paused_partitions = [*self.__consumer.paused()]
    if paused_partitions:
        if self.__processing_strategy.ready_to_continue():
            self.__consumer.resume([*paused_partitions])
        else:
            # A paused consumer should still poll periodically to avoid it's partitions
            # getting revoked by the broker after reaching the max.poll.interval.ms
            # Polling a paused consumer should never yield a message.
            assert self.__consumer.poll(0.1) is None  # <-- THIS LINE FAILS
    else:
        time.sleep(0.01)
"""

# FIXED CODE:
fixed_code = """
# Check actual consumer pause state instead of relying on internal __is_paused flag
paused_partitions = [*self.__consumer.paused()]
if paused_partitions:
    # Consumer actually has paused partitions
    if self.__is_paused and self.__processing_strategy.ready_to_continue():
        self.__consumer.resume([*paused_partitions])
        self.__is_paused = False  # Update state to match reality
    else:
        # A paused consumer should still poll periodically to avoid partitions
        # getting revoked by the broker after reaching the max.poll.interval.ms
        message = self.__consumer.poll(0.1)
        if message is not None:
            # A message was received even though we expected the consumer to be paused.
            # This can happen when external components (like SynchronizedConsumer)
            # resume partitions independently. Handle this gracefully.
            self.__is_paused = False  # Update state to reflect reality
            self.__message = message  # Store the message for processing
        # If message is None, the consumer is properly paused, continue as normal
else:
    # No paused partitions, so we're not actually paused
    if self.__is_paused:
        self.__is_paused = False  # Update state to reflect reality
    time.sleep(0.01)
"""

print("=== ARROYO STREAMPROCESSOR FIX ===")
print("\nFile to modify: arroyo/processing/processor.py")
print("\nMethod: _run_once")
print("\nFind this code block (around lines 470-485):")
print(original_code)
print("\nReplace with:")
print(fixed_code)
print("\n=== END OF FIX ===")

# The key insight is that instead of trusting the __is_paused flag (which can be out of sync),
# we should always check the actual consumer state with self.__consumer.paused()
# and handle the case where a message is received gracefully by updating our internal state.
