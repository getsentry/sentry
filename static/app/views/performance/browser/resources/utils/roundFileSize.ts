const roundFileSize = (bytes: number) => {
  if (bytes < 1024) {
    // The filesize compontent does not have fixed decimal places at all with Bytes, but Kb, Mb and Gb, etc do.
    // This will round them i.e 999.1234533333 B becomes 999.1 B
    return Math.round(bytes * 10) / 10;
  }
  return bytes;
};

export default roundFileSize;
