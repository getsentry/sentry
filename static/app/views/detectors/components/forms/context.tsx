import {createContext, useContext, useState} from 'react';

import type {Project} from 'sentry/types/project';
import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';

type DetectorFormContextType = {
  detectorType: DetectorType;
  /**
   * Tracks whether the user has manually set the detector name.
   * Used by useSetAutomaticName to disable automatic name generation.
   */
  hasSetDetectorName: boolean;
  project: Project;
  setHasSetDetectorName: (value: boolean) => void;
  detector?: Detector;
};

const DetectorFormContext = createContext<DetectorFormContextType | null>(null);

export function DetectorFormProvider({
  detectorType,
  project,
  detector,
  children,
}: {
  children: React.ReactNode;
  detectorType: DetectorType;
  project: Project;
  detector?: Detector;
}) {
  const [hasSetDetectorName, setHasSetDetectorName] = useState(false);

  return (
    <DetectorFormContext.Provider
      value={{detectorType, project, hasSetDetectorName, setHasSetDetectorName, detector}}
    >
      {children}
    </DetectorFormContext.Provider>
  );
}

export function useDetectorFormContext() {
  const context = useContext(DetectorFormContext);
  if (!context) {
    throw new Error('useDetectorFormContext must be used within a DetectorFormProvider');
  }

  return context;
}
