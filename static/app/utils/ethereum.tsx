export function formatEthAddress(address: string) {
  return address.startsWith('0x') ? address : `0x${address}`;
}

export function stripEthAddress(address: string) {
  return address.startsWith('0x') ? address.substring(2) : address;
}
