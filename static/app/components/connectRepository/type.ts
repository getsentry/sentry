export interface PathMappingValue {
  branch: string;
  sourceRoot: string;
  stackRoot: string;
  // Present for server-seeded rows in edit mode so the save diff can match
  // them back to their database records.
  id?: string;
}
