export type ReleasesV2RowData = {
  organizationId: string;
  release: ReleasesV2Release;
  crashFreeUsersPercent: number;
  graphData: GraphData;
  activeUsers: number;
  crashes: number;
  errors: number;
  releaseAdoptionPercent: number;
};

type GraphData = {
  [timePeriod: string]: [number, number][];
};

type ReleasesV2Release = {
  name: string;
  dateCreated: Date;
};
