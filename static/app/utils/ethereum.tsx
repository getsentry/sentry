export function formatEthAddress(address: string) {
  if (address === '*') {
    return address;
  }

  return address.startsWith('0x') ? address : `0x${address}`;
}

export function stripEthAddress(address: string) {
  return address.startsWith('0x') ? address.substring(2) : address;
}

export function formatWei(wei: number, format: 'gwei' | 'eth' = 'eth') {
  if (format === 'gwei') {
    return (wei / 1000000000).toLocaleString(undefined, {maximumFractionDigits: 20});
  }

  return (wei / 1000000000000000000).toLocaleString(undefined, {
    maximumFractionDigits: 20,
  });
}
