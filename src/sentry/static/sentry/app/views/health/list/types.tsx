export type HealthRowData = {
  organizationId: string;
  release: HealthRelease;
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

type HealthRelease = {
  name: string;
  dateCreated: Date;
};
