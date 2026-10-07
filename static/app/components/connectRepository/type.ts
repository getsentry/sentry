export interface PathMappingValue {
  branch: string;
  sourceRoot: string;
  stackRoot: string;
  // Server-seeded flag. Present for rows returned by the API; absent on new
  // client-created rows where Sentry has not yet assigned one.
  automaticallyGenerated?: boolean;
  // Present for server-seeded rows in edit mode so the save diff can match
  // them back to their database records.
  hasCodeOwner?: boolean;
  id?: string;
}
