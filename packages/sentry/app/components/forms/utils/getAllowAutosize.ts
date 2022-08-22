export default function getAllowAutosize() {
  // This is overridden to false in tests to be able to force autosize off since it requires style re-calcs.
  return true;
}
