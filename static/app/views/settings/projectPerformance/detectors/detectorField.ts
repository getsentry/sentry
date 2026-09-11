import {type DetectorConfigAdmin, type DetectorConfigCustomer} from './detectorSettings';

type DetectorFieldName = DetectorConfigAdmin | DetectorConfigCustomer;

export type CommonDetectorFieldProps = {
  disabled: boolean | string;
  label: string;
  name: DetectorFieldName;
  projectSlug: string;
  help?: string;
};
