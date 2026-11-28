-- Take items off one list and put them at the front of another, in one step.
-- The reverse of drain_list_into.lua.
-- KEYS[1]: the list to take the items off. KEYS[2]: the list to put them at the front of.
-- ARGV[1]: TTL in seconds for KEYS[2]. ARGV[2..]: the items, in the order they should end up.
-- Removes one copy of each item from KEYS[1]. An item that isn't there is still added
-- to KEYS[2]. On redis-cluster both keys must share a hash slot.
assert(#KEYS == 2, "provide the list to take from and the list to add to")
assert(#ARGV >= 2, "provide a TTL and at least one item")

for i = 2, #ARGV do
    redis.call("LREM", KEYS[1], 1, ARGV[i])
end
for i = #ARGV, 2, -1 do
    redis.call("LPUSH", KEYS[2], ARGV[i])
end
redis.call("EXPIRE", KEYS[2], ARGV[1])
return #ARGV - 1
