export type RemoteConfigFeature = {
  key: string;
  value: string | undefined;
};

export type RemoteConfigOptions = {
  sample_rate: number;
  traces_sample_rate: number;
};

export type RemoteConfig = {
  data: {
    features: RemoteConfigFeature[];
    options: RemoteConfigOptions;
  };
};
