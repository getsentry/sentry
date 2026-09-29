import {createContext, useContext, useState} from 'react';

import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';

type DetectorFormContextType = {
  detectorType: DetectorType;
  /**
   * Tracks whether the user has manually set the detector name.
   * Used by useSetAutomaticName to disable automatic name generation.
   */
  hasSetDetectorName: boolean;
  setHasSetDetectorName: (value: boolean) => void;
  detector?: Detector;
  duplicateDetector?: Detector;
};

const DetectorFormContext = createContext<DetectorFormContextType | null>(null);

export function DetectorFormProvider({
  detectorType,
  detector,
  duplicateDetector,
  children,
}: {
  children: React.ReactNode;
  detectorType: DetectorType;
  detector?: Detector;
  duplicateDetector?: Detector;
}) {
  const [hasSetDetectorName, setHasSetDetectorName] = useState(
    Boolean(duplicateDetector)
  );

  return (
    <DetectorFormContext.Provider
      value={{
        detectorType,
        hasSetDetectorName,
        setHasSetDetectorName,
        detector,
        duplicateDetector,
      }}
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
